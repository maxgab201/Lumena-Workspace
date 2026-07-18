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

    // 1. Mark as processing
    await supabaseClient
      .from('processing_jobs')
      .update({
        status: 'processing',
        started_at: new Date(startTime).toISOString(),
      })
      .eq('id', jobId)

    // Simulate different processing stages for a real pipeline
    // A real pipeline would use PDF.js or Surya OCR here
    const stages = ['inspecting', 'extracting', 'ocr', 'layout']
    let currentProgress = 10

    for (const stage of stages) {
      await new Promise((resolve) => setTimeout(resolve, 1500)) // Fake delay
      currentProgress += 20
      await supabaseClient
        .from('processing_jobs')
        .update({ progress: currentProgress })
        .eq('id', jobId)
      console.log(`Job ${jobId} finished stage: ${stage}`)
    }

    // Generate Knowledge Items (stubbed content but real DB persistence)
    const mockKnowledge = [
      {
        workspace_id: workspaceId,
        document_id: documentId,
        type: 'flashcard',
        content: {
          front: 'What is the main topic of this document?',
          back: 'This document was processed by the new real backend pipeline.'
        },
        metadata: { page: 1, confidence: 0.95 }
      },
      {
        workspace_id: workspaceId,
        document_id: documentId,
        type: 'glossary',
        content: {
          term: 'Pipeline',
          definition: 'A sequence of automated steps to process data or documents.'
        },
        metadata: { page: 1, confidence: 0.99 }
      }
    ]

    const { error: knowledgeError } = await supabaseClient
      .from('knowledge')
      .insert(mockKnowledge)

    if (knowledgeError) {
      console.error('Failed to insert knowledge:', knowledgeError)
      throw knowledgeError
    }

    // Update document status to ready
    await supabaseClient
      .from('documents')
      .update({ status: 'ready' })
      .eq('id', documentId)

    // Mark job as completed
    const endTime = Date.now()
    const processingTime = Math.round((endTime - startTime) / 1000)

    await supabaseClient
      .from('processing_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date(endTime).toISOString(),
        processing_time: processingTime,
      })
      .eq('id', jobId)

    console.log(`Job ${jobId} completed successfully in ${processingTime}s.`)

    return new Response(JSON.stringify({ success: true, jobId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Processing job failed:', error)
    
    // Attempt to mark as failed
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
            error_message: error.message || 'Unknown processing error'
          })
          .eq('id', jobId)
      }
    } catch {
      // Ignore inner catch errors
    }

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
