import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { extractText, getDocumentProxy } from "npm:unpdf@1.6.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Hoist jobId so the catch block can access it without re-reading the body
  let jobId: string | null = null

  try {
    // Validate content type
    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    const job = payload.record

    // Validate job structure
    if (!job || typeof job !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid payload: missing record' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!job.id || !job.document_id || !job.workspace_id) {
      return new Response(JSON.stringify({ error: 'Invalid job: missing required fields (id, document_id, workspace_id)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(job.id) || !uuidRegex.test(job.document_id) || !uuidRegex.test(job.workspace_id)) {
      return new Response(JSON.stringify({ error: 'Invalid UUID format in job fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (job.status !== 'queued') {
      return new Response(JSON.stringify({ error: `Invalid job status: ${job.status} (expected: queued)` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    jobId = job.id
    const documentId = job.document_id
    const workspaceId = job.workspace_id
    const startTime = Date.now()

    console.log(`Starting processing for job ${jobId} (Document: ${documentId})`)

    // ==========================================
    // 1. VERIFY DOCUMENT & ESTIMATE CREDITS
    // ==========================================
    const { data: docData } = await supabaseClient
      .from('documents')
      .select('page_count, workspace_id')
      .eq('id', documentId)
      .single()

    // Verify document exists and belongs to the claimed workspace
    if (!docData || docData.workspace_id !== workspaceId) {
      console.error(`Job ${jobId}: Document ${documentId} not found or workspace mismatch`)
      await supabaseClient
        .from('processing_jobs')
        .update({ status: 'failed', error_message: 'Document not found or workspace mismatch' })
        .eq('id', jobId)
      return new Response(JSON.stringify({ error: 'Document not found or workspace mismatch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const pageCount = docData?.page_count || 1;
    const estimatedCost = Math.max(pageCount * 5, 20);

    // Credit reservation with optimistic locking.
    // NOTE: Supabase JS doesn't support `column = column - value` expressions,
    // so we cannot do a fully atomic UPDATE in one step.
    // We use optimistic locking: read the current value, then update only if unchanged.
    // Race condition window is very small (microseconds between read and write).
    // TODO: Create a PostgreSQL RPC function `reserve_credits(p_workspace_id, p_amount)`
    //       for fully atomic deduction when the credit system is production-ready.

    const { data: accountData } = await supabaseClient
      .from('credit_accounts')
      .select('available, reserved')
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

    const { data: reservation, error: reservationInsertError } = await supabaseClient
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

    if (reservationInsertError) throw new Error('Failed to reserve credits: ' + reservationInsertError.message)
    const reservationId = reservation.id;

    // Optimistic lock: only deduct if the available balance hasn't changed since we read it
    const { error: deductError } = await supabaseClient
      .from('credit_accounts')
      .update({
        available: accountData.available - estimatedCost,
        reserved: (accountData.reserved || 0) + estimatedCost
      })
      .eq('workspace_id', workspaceId)
      .eq('available', accountData.available)

    if (deductError) {
      // If optimistic lock failed (race condition), release the reservation
      await supabaseClient
        .from('credit_reservations')
        .update({ status: 'released' })
        .eq('id', reservationId)
      throw new Error('Credit deduction failed due to concurrent modification. Please retry.')
    }

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

    const { data: pdfData, error: downloadError } = await supabaseClient
      .storage
      .from('workspace_documents')
      .download(docFull.file_path)

    if (downloadError) {
      throw new Error(`Failed to download PDF: ${downloadError.message}`)
    }

    // ==========================================
    // Extract native text with unpdf
    // ==========================================
    console.log(`Job ${jobId}: Extracting native text...`)
    await supabaseClient
      .from('processing_jobs')
      .update({ progress: 30 })
      .eq('id', jobId)

    const pdfBytes = new Uint8Array(await pdfData.arrayBuffer())
    const pdf = await getDocumentProxy(pdfBytes)

    let pageTexts: string[] = []
    let totalPages = 0
    try {
      const result = await extractText(pdf, { mergePages: false })
      pageTexts = result.text
      totalPages = pdf.numPages
    } finally {
      // Always clean up the PDF document proxy to free memory
      pdf.destroy()
    }

    // Determine if PDF has native text (digital) or is scanned
    const hasNativeText = pageTexts.some((t: string) => t.trim().length > 0)

    await supabaseClient
      .from('processing_jobs')
      .update({ progress: 60 })
      .eq('id', jobId)

    if (hasNativeText) {
      // Digital PDF: save extracted text to document_pages
      console.log(`Job ${jobId}: Digital PDF detected. Saving ${totalPages} pages of text...`)

      for (let i = 0; i < totalPages; i++) {
        const pageText = (pageTexts[i] || '').trim()
        if (pageText.length > 0) {
          await supabaseClient
            .from('document_pages')
            .upsert({
              document_id: documentId,
              page_number: i,
              raw_text: pageText,
              ocr_provider: 'native',
              confidence: 1.0,
            }, { onConflict: 'document_id,page_number' })
        }
      }

      await supabaseClient
        .from('processing_jobs')
        .update({ progress: 90 })
        .eq('id', jobId)

      await supabaseClient
        .from('documents')
        .update({
          ocr_status: 'completed',
          page_count: totalPages,
          status: 'ready',
        })
        .eq('id', documentId)

      console.log(`Job ${jobId}: Text extraction complete (${totalPages} pages)`)
    } else {
      // Scanned PDF: delegate to client-side OCR
      console.log(`Job ${jobId}: Scanned PDF detected. Marking for client-side OCR (${totalPages} pages)...`)

      await supabaseClient
        .from('documents')
        .update({
          ocr_status: 'needs_client_ocr',
          page_count: totalPages,
          status: 'ready',
        })
        .eq('id', documentId)
    }

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

    // Use the hoisted jobId — don't re-read the consumed request body
    if (jobId) {
      try {
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
      } catch {
        // Ignore inner catch errors
      }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
