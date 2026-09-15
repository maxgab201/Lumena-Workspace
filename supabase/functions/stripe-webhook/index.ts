import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import Stripe from "https://esm.sh/stripe@14.18.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
}) : null

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!stripe || !stripeWebhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Stripe not configured' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response(
      JSON.stringify({ error: 'Missing stripe-signature header' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let event: Stripe.Event
  const body = await req.text() // raw body — required for signature verification

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret)
  } catch {
    console.error('Webhook signature verification failed')
    return new Response(
      JSON.stringify({ error: 'Webhook signature verification failed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`Stripe event: ${event.type} (${event.id})`)

  // ─── IDEMPOTENCY ────────────────────────────────────────────────
  // payment_events.external_event_id has a UNIQUE constraint. Claim the event
  // first; if the insert conflicts, this is a replay and we acknowledge it
  // without doing anything — credits can never be granted twice.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { error: claimError } = await supabase
    .from('payment_events')
    .insert({
      provider: 'stripe',
      external_event_id: event.id,
      event_type: event.type,
      status: 'processing',
    })

  if (claimError) {
    if (claimError.code === '23505') {
      console.log(`Event ${event.id} already processed — replay acknowledged, no action`)
      return new Response(JSON.stringify({ received: true, replay: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    console.error('Failed to record payment event:', claimError.message)
    return new Response(JSON.stringify({ error: 'Event record failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(supabase, event.data.object as Stripe.Checkout.Session)
        break
      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(supabase, event.data.object as Stripe.Checkout.Session)
        break
      case 'invoice.paid':
        await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscriptionState(supabase, sub, event.type === 'customer.subscription.deleted')
        break
      }
      default:
        console.log(`Unhandled Stripe event: ${event.type}`)
    }

    await supabase
      .from('payment_events')
      .update({ status: 'processed' })
      .eq('external_event_id', event.id)

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Webhook handler error:', err)
    // Release the claim so Stripe's retry can be processed fresh
    await supabase
      .from('payment_events')
      .delete()
      .eq('external_event_id', event.id)
    return new Response(
      JSON.stringify({ error: 'Webhook handler error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(supabase: ReturnType<typeof createClient>, session: Stripe.Checkout.Session) {
  console.log(`Processing checkout completed: ${session.id} (mode: ${session.mode})`)

  if (session.mode === 'subscription') {
    await activatePlanSubscription(supabase, session)
  } else {
    await fulfillCreditPurchase(supabase, session)
  }
}

/** One-time credit package fulfilment. Credits are granted via the audited RPC. */
async function fulfillCreditPurchase(supabase: ReturnType<typeof createClient>, session: Stripe.Checkout.Session) {
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('*')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (purchaseError || !purchase) {
    console.error('Purchase not found for session:', session.id)
    return // not created by this system — ack to stop Stripe retries
  }

  if (purchase.status === 'completed') {
    console.log('Purchase already completed, skipping')
    return
  }

  // Verify the payment actually succeeded (never trust success_url alone)
  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
  if (!paid) {
    console.warn(`Session ${session.id} completed but payment_status=${session.payment_status} — marking purchase failed`)
    await supabase.from('purchases').update({ status: 'failed' }).eq('id', purchase.id)
    return
  }

  const { data: pkg, error: pkgError } = await supabase
    .from('credit_packages')
    .select('credits')
    .eq('id', purchase.package_id)
    .single()

  if (pkgError || !pkg) throw new Error('Credit package not found')

  // Idempotent, ledger-audited grant (unique purchase row + status guard above)
  const { error: purchaseUpdateError } = await supabase
    .from('purchases')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', purchase.id)
    .eq('status', 'pending') // guard: only transition once
  if (purchaseUpdateError) throw purchaseUpdateError

  const { error: grantError } = await supabase.rpc('grant_credits', {
    p_workspace_id: purchase.workspace_id,
    p_amount: pkg.credits,
    p_source: 'purchase',
    p_expires_at: null, // purchased credits do not expire
    p_priority: 10,
    p_idempotency_key: `purchase:${purchase.id}`,
  })
  if (grantError) throw grantError

  console.log(`Granted ${pkg.credits} credits for purchase ${purchase.id}`)
}

/** checkout.session.completed with mode=subscription → activate the plan. */
async function activatePlanSubscription(supabase: ReturnType<typeof createClient>, session: Stripe.Checkout.Session) {
  const planCode = session.metadata?.plan_code
  if (!planCode) {
    console.error('Subscription checkout missing plan_code metadata:', session.id)
    return
  }
  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('code', planCode)
    .single()
  if (!plan) throw new Error(`Plan ${planCode} not found`)

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      workspace_id: session.client_reference_id ?? session.metadata?.workspace_id,
      provider: 'stripe',
      external_subscription_id: subscriptionId,
      plan_id: plan.id,
      plan_code: planCode,
      status: 'active',
    }, { onConflict: 'workspace_id' })
  if (error) throw error

  // Grant the first month's credits (subscription credits expire with the cycle)
  const { data: planRow } = await supabase
    .from('plans')
    .select('monthly_credits')
    .eq('id', plan.id)
    .single()
  if (planRow?.monthly_credits && planRow.monthly_credits > 0) {
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    const { error: grantError } = await supabase.rpc('grant_credits', {
      p_workspace_id: session.client_reference_id,
      p_amount: planRow.monthly_credits,
      p_source: 'subscription',
      p_expires_at: periodEnd.toISOString(),
      p_priority: 100,
      p_idempotency_key: `sub-first:${session.id}`,
    })
    if (grantError) throw grantError
  }
}

/** Monthly renewal: invoice.paid grants the next cycle's plan credits. */
async function handleInvoicePaid(supabase: ReturnType<typeof createClient>, invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.parent?.subscription
  if (!subscriptionId) return // one-time payment invoices are handled by checkout

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, workspace_id, plan_code')
    .eq('external_subscription_id', subscriptionId)
    .maybeSingle()
  if (!sub) {
    console.warn(`Invoice for unknown subscription ${subscriptionId}`)
    return
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('id, monthly_credits')
    .eq('code', sub.plan_code)
    .single()
  if (!plan || !plan.monthly_credits) return

  const periodEnd = new Date(invoice.period_end * 1000)
  const { error } = await supabase.rpc('grant_credits', {
    p_workspace_id: sub.workspace_id,
    p_amount: plan.monthly_credits,
    p_source: 'subscription',
    p_expires_at: periodEnd.toISOString(),
    p_priority: 100,
    p_idempotency_key: `renewal:${invoice.id}`,
  })
  if (error) throw error
  console.log(`Renewal granted ${plan.monthly_credits} credits for subscription ${subscriptionId}`)
}

/** subscription.updated / deleted → reconcile status + cancel_at_period_end. */
async function syncSubscriptionState(supabase: ReturnType<typeof createClient>, stripeSub: Stripe.Subscription, deleted: boolean) {
  const status = deleted ? 'canceled' : stripeSub.status
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('external_subscription_id', stripeSub.id)
    .maybeSingle()
  if (!sub) {
    console.warn(`Subscription ${stripeSub.id} not found locally`)
    return
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      cancel_at_period_end: stripeSub.cancel_at_period_end ?? false,
      current_period_start: stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000).toISOString() : null,
      current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sub.id)
  if (error) throw error
}
