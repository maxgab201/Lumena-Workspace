import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import Stripe from "https://esm.sh/stripe@14.12.0?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const payload = await req.json()
    const { workspace_id, package_id, success_url, cancel_url } = payload

    if (!workspace_id || !package_id) {
      return new Response(JSON.stringify({ error: 'Missing workspace_id or package_id' }), { status: 400, headers: corsHeaders })
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

    // Fetch Package details
    const { data: pkg, error: pkgError } = await supabaseClient
      .from('credit_packages')
      .select('*')
      .eq('id', package_id)
      .single()

    if (pkgError || !pkg) {
      return new Response(JSON.stringify({ error: 'Credit package not found' }), { status: 404, headers: corsHeaders })
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      console.warn("STRIPE_SECRET_KEY not found in environment. Mocking checkout success URL for preview environment.");
      // For the preview environment without keys, we mock a redirect to the success URL
      return new Response(JSON.stringify({ 
        url: `${success_url}?session_id=mock_session_id`,
        mocked: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Real Stripe Integration
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let stripePriceId = pkg.stripe_price_id

    // Fallback if price ID is missing or invalid in a real environment
    // Note: in a true production system, you strictly rely on the DB stripe_price_id
    if (!stripePriceId || stripePriceId.includes('mock')) {
      const price = await stripe.prices.create({
        unit_amount: Math.round(pkg.price_usd * 100),
        currency: 'usd',
        product_data: {
          name: pkg.name,
          description: pkg.description || undefined
        }
      });
      stripePriceId = price.id;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url,
      client_reference_id: workspace_id,
      metadata: {
        workspace_id,
        user_id: user.id,
        package_id: pkg.id,
        credits: pkg.credits.toString()
      }
    })

    // Log the pending purchase
    await supabaseClient.from('purchases').insert({
      workspace_id,
      user_id: user.id,
      package_id: pkg.id,
      stripe_session_id: session.id,
      amount_usd: pkg.price_usd,
      credits_granted: pkg.credits,
      status: 'pending'
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('Create checkout session error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
