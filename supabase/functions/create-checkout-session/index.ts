import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import Stripe from "https://esm.sh/stripe@14.12.0?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutRequest {
  workspace_id: string
  product: { kind: 'package', id: string } | { kind: 'plan', code: string }
  success_url: string
  cancel_url: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      // HONEST DEGRADATION: never fake a success redirect. The client shows
      // "payments not configured" instead of pretending a purchase happened.
      return new Response(JSON.stringify({
        error: 'Payments are not available yet.',
        code: 'stripe_not_configured',
      }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const payload: CheckoutRequest = await req.json()
    const { workspace_id, product, success_url, cancel_url } = payload

    if (!workspace_id || !product?.kind || !success_url || !cancel_url) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id, product, success_url or cancel_url' }), { status: 400, headers: corsHeaders })
    }

    // Verify workspace access
    const { data: workspaceAccess } = await supabaseClient
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!workspaceAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let lineItem: { price: string; quantity: number }
    let mode: 'payment' | 'subscription'
    let purchaseRow: Record<string, unknown> | null = null

    if (product.kind === 'package') {
      // ─── One-time credit package: price comes ONLY from the DB row ───
      const { data: pkg, error: pkgError } = await supabaseClient
        .from('credit_packages')
        .select('*')
        .eq('id', product.id)
        .eq('is_active', true)
        .single()

      if (pkgError || !pkg) {
        return new Response(JSON.stringify({ error: 'Credit package not found' }), { status: 404, headers: corsHeaders })
      }
      if (!pkg.stripe_price_id || !pkg.stripe_price_id.startsWith('price_') || pkg.stripe_price_id.includes('mock')) {
        // The package is not provisioned in Stripe yet — never improvise a price.
        return new Response(JSON.stringify({
          error: 'This package is not available for purchase yet.',
          code: 'price_not_provisioned',
        }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      lineItem = { price: pkg.stripe_price_id, quantity: 1 }
      mode = 'payment'

      // Persist the pending purchase BEFORE redirecting (webhook reconciles it)
      const { data: purchase, error: purchaseError } = await supabaseClient
        .from('purchases')
        .insert({
          workspace_id,
          user_id: user.id,
          package_id: pkg.id,
          amount_usd: pkg.price_usd,
          credits_granted: pkg.credits,
          status: 'pending',
        })
        .select()
        .single()
      if (purchaseError) throw purchaseError
      purchaseRow = purchase
    } else if (product.kind === 'plan') {
      // ─── Recurring plan subscription: resolve Stripe price from plan_prices ───
      const { data: plan } = await supabaseClient
        .from('plans')
        .select('id, code')
        .eq('code', product.code)
        .single()
      if (!plan) {
        return new Response(JSON.stringify({ error: 'Plan not found' }), { status: 404, headers: corsHeaders })
      }
      if (plan.code === 'free') {
        return new Response(JSON.stringify({ error: 'Cannot check out the Free plan' }), { status: 400, headers: corsHeaders })
      }

      const { data: price } = await supabaseClient
        .from('plan_prices')
        .select('*')
        .eq('plan_id', plan.id)
        .eq('billing_interval', 'month')
        .limit(1)
        .maybeSingle()

      if (!price || !price.external_price_id || !price.external_price_id.startsWith('price_')) {
        return new Response(JSON.stringify({
          error: 'This plan is not available for purchase yet.',
          code: 'price_not_provisioned',
        }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      lineItem = { price: price.external_price_id, quantity: 1 }
      mode = 'subscription'
    } else {
      return new Response(JSON.stringify({ error: 'Invalid product kind' }), { status: 400, headers: corsHeaders })
    }

    // Reuse/create the Stripe customer for this user+workspace
    const { data: customerRow } = await supabaseClient
      .from('billing_customers')
      .select('external_customer_id')
      .eq('workspace_id', workspace_id)
      .maybeSingle()

    let customerId: string | undefined
    if (customerRow?.external_customer_id) {
      customerId = customerRow.external_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { workspace_id, user_id: user.id },
      })
      customerId = customer.id
      await supabaseClient
        .from('billing_customers')
        .upsert({ workspace_id, external_customer_id: customerId, billing_email: user.email }, { onConflict: 'workspace_id' })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode,
      success_url: `${success_url}${success_url.includes('?') ? '&' : '?'}purchase=success&purchase_id=${purchaseRow?.id ?? ''}`,
      cancel_url: cancel_url,
      client_reference_id: workspace_id,
      metadata: {
        workspace_id,
        user_id: user.id,
        product_kind: product.kind,
        ...(product.kind === 'package' ? { package_id: product.id } : { plan_code: product.code }),
        ...(purchaseRow ? { purchase_id: purchaseRow.id } : {}),
      },
    })

    if (purchaseRow) {
      await supabaseClient
        .from('purchases')
        .update({ stripe_session_id: session.id })
        .eq('id', purchaseRow.id)
    }

    return new Response(JSON.stringify({ url: session.url, mode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('Create checkout session error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
