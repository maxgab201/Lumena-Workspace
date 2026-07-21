import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const job = payload.record

    if (!job || !job.id || job.status !== 'queued') {
      return new Response(JSON.stringify({ error: 'Invalid or missing job record' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const jobId = job.id
    const documentId = job.document_id
    const workspaceId = job.workspace_id
    const startTime = Date.now()

    console.log(`Starting processing for job ${jobId} (Document: ${documentId})`)

    // ==========================================
    // 1. ESTIMATE & RESERVE CREDITS
    // ==========================================
    const { data: docData } = await supabaseClient
      .from('documents')
      .select('page_count')
      .eq('id', documentId)
      .single()

    const pageCount = docData?.page_count || 1;
    const estimatedCost = Math.max(pageCount * 5, 20);

    const { data: accountData } = await supabaseClient
      .from('credit_accounts')
      .select('available')
      .eq('workspace_id', workspaceId)
      .single()

    if (!accountData || accountData.available < estimatedCost) {
      console.error(`Job ${jobId} failed: Insufficient credits`)
      await supabaseClient
        .from('processing_jobs')
        .update({
          status: 'failed',
          error_message: `Insufficient credits. Required: ${estimatedCost}, Available: ${accountData?.available || 0}`
        })
        .eq('id', jobId)

      return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402,
      })
    }

    const { data: reservation, error: reserveError } = await supabaseClient
      .from('credit_reservations')
      .insert({
        workspace_id: workspaceId,
        job_id: jobId,
        requested_amount: estimatedCost,
        reserved_amount: estimatedCost,
        expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        status: 'pending'
      })
      .select('id')
      .single()

    if (reserveError) throw new Error('Failed to reserve credits: ' + reserveError.message)
    const reservationId = reservation.id;

    await supabaseClient
      .from('credit_accounts')
      .update({
        available: accountData.available - estimatedCost,
        reserved: (accountData.reserved || 0) + estimatedCost
      })
      .eq('workspace_id', workspaceId)

    await supabaseClient
      .from('credit_ledger')
      .insert({
        workspace_id: workspaceId,
        entry_type: 'reserve',
        amount: estimatedCost,
        direction: -1,
        reservation_id: reservationId,
        job_id: jobId
      })

    // ==========================================
    // 2. PROCESS DOCUMENT
    // ==========================================
    await supabaseClient
      .from('processing_jobs')
      .update({
        status: 'processing',
        started_at: new Date(startTime).toISOString(),
      })
      .eq('id', jobId)

    const { data: docFull } = await supabaseClient
      .from('documents')
      .select('id, name, file_path, workspace_id, page_count')
      .eq('id', documentId)
      .single()

    if (!docFull || !docFull.file_path) {
      throw new Error('Document or file path not found')
    }

    console.log(`Job ${jobId}: Downloading PDF...`)
    await supabaseClient
      .from('processing_jobs')
      .update({ progress: 10 })
      .eq('id', jobId)

    const { error: downloadError } = await supabaseClient
      .storage
      .from('workspace_documents')
      .download(docFull.file_path)

    if (downloadError) {
      throw new Error(`Failed to download PDF: ${downloadError.message}`)
    }

    // Mark for client-side OCR (pdfjs-dist requires canvas which isn't available in Deno)
    console.log(`Job ${jobId}: Marking document for client-side OCR...`)
    await supabaseClient
      .from('processing_jobs')
      .update({ progress: 50 })
      .eq('id', jobId)

    const totalPages = docFull.page_count || 1

    await supabaseClient
      .from('processing_jobs')
      .update({ progress: 80 })
      .eq('id', jobId)

    console.log(`Job ${jobId}: Document marked for client-side OCR (${totalPages} pages)`)

    await supabaseClient
      .from('documents')
      .update({
        ocr_status: 'needs_client_ocr',
        page_count: totalPages,
        status: 'ready',
      })
      .eq('id', documentId)

    const endTime = Date.now()
    const processingTime = Math.round((endTime - startTime) / 1000)

    // ==========================================
    // 3. SETTLE CREDITS
    // ==========================================
    const actualCost = estimatedCost;

    await supabaseClient
      .from('credit_reservations')
      .update({
        status: 'confirmed',
        settled_amount: actualCost
      })
      .eq('id', reservationId)

    await supabaseClient
      .from('credit_ledger')
      .insert({
        workspace_id: workspaceId,
        entry_type: 'consume',
        amount: actualCost,
        direction: -1,
        reservation_id: reservationId,
        job_id: jobId
      })

    const { data: finalAccount } = await supabaseClient
      .from('credit_accounts')
      .select('reserved, consumed')
      .eq('workspace_id', workspaceId)
      .single()

    if (finalAccount) {
      await supabaseClient
        .from('credit_accounts')
        .update({
          reserved: Math.max(0, (finalAccount.reserved || 0) - estimatedCost),
          consumed: (finalAccount.consumed || 0) + actualCost
        })
        .eq('workspace_id', workspaceId)
    }

    await supabaseClient
      .from('processing_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date(endTime).toISOString(),
        processing_time: processingTime,
      })
      .eq('id', jobId)

    console.log(`Job ${jobId} completed successfully in ${processingTime}s. Cost: ${actualCost} credits.`)

    return new Response(JSON.stringify({ success: true, jobId, cost: actualCost }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
    console.error('Processing job failed:', error)

    try {
      const payload = await req.json().catch(() => ({}))
      const jobId = payload?.record?.id
      if (jobId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        await supabaseClient
          .from('processing_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage
          })
          .eq('id', jobId)
      }
    } catch {
      // Ignore inner catch errors
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
