import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import Stripe from "https://esm.sh/stripe@14.18.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY not set - webhook will not work in production')
}

if (!stripeWebhookSecret) {
  console.warn('STRIPE_WEBHOOK_SECRET not set - webhook verification will fail')
}

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
  const body = await req.text()

  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret)
  } catch {
    console.error('Webhook signature verification failed')
    return new Response(
      JSON.stringify({ error: 'Webhook signature verification failed' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`Stripe event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session)
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionExpired(session)
        break
      }
      case 'payment_intent.succeeded': {
        // Handle direct payment intent success if needed
        break
      }
      case 'payment_intent.payment_failed': {
        // Handle failed payment intent if needed
        break
      }
      default:
        console.log(`Unhandled Stripe event: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    console.error('Webhook handler error')
    return new Response(
      JSON.stringify({ error: 'Webhook handler error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log(`Processing checkout completed: ${session.id}`)

  // Find the purchase record by stripe_session_id
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('*')
    .eq('stripe_session_id', session.id)
    .single()

  if (purchaseError || !purchase) {
    console.error('Purchase not found for session:', session.id)
    // Don't throw - the session might have been created outside our system
    // Log and return success to avoid Stripe retrying
    return
  }

  if (purchase.status === 'completed') {
    console.log(`Purchase already completed, skipping`)
    return
  }

  // Get the credit package to verify credits
  const { data: pkg, error: pkgError } = await supabase
    .from('credit_packages')
    .select('credits')
    .eq('id', purchase.package_id)
    .single()

  if (pkgError || !pkg) {
    console.error('Credit package not found')
    throw new Error('Credit package not found')
  }

  const creditsToGrant = pkg.credits

  // Start a transaction-like sequence for credit granting
  // 1. Update purchase status to completed
  const { error: updatePurchaseError } = await supabase
    .from('purchases')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      credits_granted: creditsToGrant,
    })
    .eq('id', purchase.id)

  if (updatePurchaseError) {
    console.error('Failed to update purchase status')
    throw updatePurchaseError
  }

  // 2. Create credit ledger entry (grant_purchase)
  const { error: ledgerError } = await supabase
    .from('credit_ledger')
    .insert({
      workspace_id: purchase.workspace_id,
      entry_type: 'grant_purchase',
      amount: creditsToGrant,
      direction: 1,
      purchase_id: purchase.id,
      description: `Purchase of ${creditsToGrant} credits via Stripe`,
    })

  if (ledgerError) {
    console.error('Failed to insert credit ledger entry')
    throw ledgerError
  }

  // 3. Create credit bucket for this purchase
  const { error: bucketError } = await supabase
    .from('credit_buckets')
    .insert({
      workspace_id: purchase.workspace_id,
      source_type: 'purchase',
      source_id: purchase.id,
      initial_amount: creditsToGrant,
      remaining_amount: creditsToGrant,
      priority: 10, // Purchases have high priority (used before monthly grants)
      expires_at: null, // Purchased credits don't expire
    })

  if (bucketError) {
    console.error('Failed to insert credit bucket')
    throw bucketError
  }

  // 4. Update credit_accounts (increment available)
  const { error: accountError } = await supabase.rpc('increment_credit_account', {
    p_workspace_id: purchase.workspace_id,
    p_amount: creditsToGrant,
  })

  if (accountError) {
    console.error('Failed to increment credit account')
    throw accountError
  }

  console.log(`Granted ${creditsToGrant} credits for purchase ${purchase.id}`)
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log(`Checkout session expired: ${session.id}`)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { error } = await supabase
    .from('purchases')
    .update({ status: 'failed' })
    .eq('stripe_session_id', session.id)

  if (error) {
    console.error('Failed to update purchase status to failed')
  }
}