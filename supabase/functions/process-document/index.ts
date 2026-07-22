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
    // ==========================================
    // AUTHENTICATION: Verify request comes from our pg_net webhook
    // ==========================================
    // The PostgreSQL trigger sends Authorization: Bearer <SUPABASE_ANON_KEY>.
    // We verify this matches our expected anon key to reject unauthorized requests.
    const authHeader = req.headers.get('authorization')
    const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error(`[SECURITY] Rejected request: missing or malformed Authorization header. IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`)
      return new Response(JSON.stringify({ error: 'Unauthorized: missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const token = authHeader.replace('Bearer ', '')
    if (token !== expectedAnonKey) {
      console.error(`[SECURITY] Rejected request: invalid Bearer token. IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`)
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // ==========================================
    // SCHEMA VALIDATION: Strict payload structure check
    // ==========================================
    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      console.error(`[SECURITY] Rejected request: invalid content-type: ${contentType}`)
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Limit request body size (prevent DoS via large payloads)
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10)
    if (contentLength > 10240) { // 10KB max for job payloads
      console.error(`[SECURITY] Rejected request: payload too large (${contentLength} bytes)`)
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 413,
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let payload: Record<string, unknown>
    try {
      payload = await req.json()
    } catch {
      console.error(`[SECURITY] Rejected request: invalid JSON body`)
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Strict schema: must have exactly { record: { id, document_id, workspace_id, status, ... } }
    const job = payload.record as Record<string, unknown> | undefined
    if (!job || typeof job !== 'object' || Array.isArray(job)) {
      console.error(`[SECURITY] Rejected request: missing or invalid "record" field`)
      return new Response(JSON.stringify({ error: 'Invalid payload: missing or invalid "record"' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Required fields with type checks
    const requiredFields = ['id', 'document_id', 'workspace_id', 'status']
    for (const field of requiredFields) {
      if (typeof job[field] !== 'string' || !job[field]) {
        console.error(`[SECURITY] Rejected request: missing or non-string field "${field}"`)
        return new Response(JSON.stringify({ error: `Invalid job: "${field}" must be a non-empty string` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }

    // UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(job.id as string) || !uuidRegex.test(job.document_id as string) || !uuidRegex.test(job.workspace_id as string)) {
      console.error(`[SECURITY] Rejected request: invalid UUID format`)
      return new Response(JSON.stringify({ error: 'Invalid UUID format in job fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Status must be exactly 'queued'
    if (job.status !== 'queued') {
      console.error(`[SECURITY] Rejected request: unexpected job status "${job.status}"`)
      return new Response(JSON.stringify({ error: `Invalid job status: ${job.status} (expected: queued)` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Reject unknown top-level fields (strict schema)
    const knownFields = ['record']
    for (const key of Object.keys(payload)) {
      if (!knownFields.includes(key)) {
        console.error(`[SECURITY] Rejected request: unexpected field "${key}" in payload`)
        return new Response(JSON.stringify({ error: `Unexpected field: ${key}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }

    jobId = job.id as string
    const documentId = job.document_id as string
    const workspaceId = job.workspace_id as string
    const startTime = Date.now()

    // ==========================================
    // RATE LIMITING: Max 10 processing jobs per workspace per hour
    // ==========================================
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentJobs } = await supabaseClient
      .from('processing_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', oneHourAgo)

    if (recentJobs && recentJobs >= 10) {
      console.error(`[RATE-LIMIT] Rejected job ${jobId}: workspace ${workspaceId} has ${recentJobs} jobs in the last hour`)
      await supabaseClient
        .from('processing_jobs')
        .update({ status: 'failed', error_message: 'Rate limit exceeded: max 10 processing jobs per hour' })
        .eq('id', jobId)
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      })
    }

    console.log(`[AUTH] Validated request for job ${jobId} (Document: ${documentId}, Workspace: ${workspaceId})`)

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
