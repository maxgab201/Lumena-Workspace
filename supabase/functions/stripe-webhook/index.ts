import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.12.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify Stripe signature
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response('No signature provided', { status: 400 })
    }

    const payload = await req.text()
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!stripeSecret || !webhookSecret) {
      console.error('Missing Stripe configuration')
      return new Response('Webhook not configured', { status: 500 })
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    console.log(`Received Stripe Event: ${event.type} [${event.id}]`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Idempotency: check if we've already processed this event successfully
    const { data: existingEvent } = await supabase
      .from('payment_events')
      .select('id, status')
      .eq('external_event_id', event.id)
      .eq('status', 'processed')
      .maybeSingle()

    if (existingEvent) {
      console.log(`Event ${event.id} already processed, skipping`)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Log the event
    await supabase.from('payment_events').insert({
      provider: 'stripe',
      external_event_id: event.id,
      event_type: event.type,
      payload: event as any,
      processed_at: new Date().toISOString(),
      status: 'processing',
    })

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session
          console.log(`Checkout completed for session: ${session.id}`)

          const workspaceId = session.client_reference_id
          if (!workspaceId) {
            console.error('No workspace_id in client_reference_id')
            break
          }

          // Grant credits from the credit package
          const packageId = session.metadata?.package_id
          if (packageId) {
            const { data: pkg } = await supabase
              .from('credit_packages')
              .select('credits')
              .eq('id', packageId)
              .single()

            if (pkg?.credits) {
              await supabase.rpc('grant_credits_simple', {
                p_workspace_id: workspaceId,
                p_amount: pkg.credits,
                p_source: 'purchase',
                p_expires_at: null,
                p_priority: 50,
                p_idempotency_key: `stripe-purchase:${session.id}`,
              })
            }
          }

          // Update subscription if this was a subscription purchase
          const subscriptionId = session.subscription
          if (subscriptionId) {
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)
            const planId = stripeSubscription.items.data[0]?.price?.metadata?.plan_id

            if (planId) {
              await supabase
                .from('subscriptions')
                .upsert({
                  workspace_id: workspaceId,
                  plan_id: planId,
                  status: 'active',
                  external_subscription_id: subscriptionId,
                  provider: 'stripe',
                  current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: stripeSubscription.cancel_at_period_end,
                }, { onConflict: 'workspace_id' })
            }
          }
          break
        }

        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice
          console.log(`Invoice paid: ${invoice.id}`)

          const subscriptionId = invoice.subscription
          if (subscriptionId) {
            // This is a recurring subscription payment
            const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
            const workspaceId = stripeSubscription.metadata?.workspace_id

            if (workspaceId) {
              // Expire old subscription credits
              await supabase.rpc('expire_credits_simple', { p_workspace_id: workspaceId })

              // Grant new monthly credits
              const planId = stripeSubscription.items.data[0]?.price?.metadata?.plan_id
              if (planId) {
                const { data: plan } = await supabase
                  .from('plans')
                  .select('monthly_credits, id')
                  .eq('id', planId)
                  .single()

                if (plan?.monthly_credits && plan.monthly_credits > 0) {
                  await supabase.rpc('grant_credits_simple', {
                    p_workspace_id: workspaceId,
                    p_amount: plan.monthly_credits,
                    p_source: 'subscription',
                    p_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    p_priority: 10,
                    p_idempotency_key: `stripe-renewal:${invoice.id}`,
                  })
                }

                // Update subscription period
                await supabase
                  .from('subscriptions')
                  .update({
                    current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
                    current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
                    status: 'active',
                  })
                  .eq('external_subscription_id', subscriptionId)
              }
            }
          }
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice
          console.log(`Invoice payment failed: ${invoice.id}`)

          const subscriptionId = invoice.subscription
          if (subscriptionId) {
            const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
            const workspaceId = stripeSubscription.metadata?.workspace_id

            if (workspaceId) {
              await supabase
                .from('subscriptions')
                .update({ status: 'past_due' })
                .eq('external_subscription_id', subscriptionId)
            }
          }
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription
          console.log(`Subscription deleted: ${subscription.id}`)

          const workspaceId = subscription.metadata?.workspace_id
          if (workspaceId) {
            await supabase
              .from('subscriptions')
              .update({ status: 'canceled' })
              .eq('external_subscription_id', subscription.id)

            // Expire subscription credits
            await supabase.rpc('expire_credits_simple', { p_workspace_id: workspaceId })
          }
          break
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription
          console.log(`Subscription updated: ${subscription.id}`)

          const workspaceId = subscription.metadata?.workspace_id
          if (workspaceId) {
            await supabase
              .from('subscriptions')
              .update({
                status: subscription.status,
                cancel_at_period_end: subscription.cancel_at_period_end,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              })
              .eq('external_subscription_id', subscription.id)
          }
          break
        }

        default:
          console.log(`Unhandled event type: ${event.type}`)
      }

      // Mark event as processed
      await supabase
        .from('payment_events')
        .update({ status: 'processed' })
        .eq('external_event_id', event.id)

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })

    } catch (err: any) {
      console.error('Webhook processing error:', err)

      // Log the error
      await supabase
        .from('payment_events')
        .update({ status: 'failed' })
        .eq('external_event_id', event.id)

      return new Response(`Webhook Error: ${err.message}`, { status: 500 })
    }
  } catch (err: any) {
    console.error('Webhook error:', err)
    return new Response(`Webhook Error: ${err.message}`, { status: 500 })
  }
})