import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@1.3.2"

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
const EMBEDDING_MODEL = "gemini-embedding-001" // 768 dims by default

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ==========================================
// CHUNKING UTILITY (embedded in Edge Function)
// ==========================================
function chunkText(
  pages: string[],
  options: { maxTokens?: number; overlapSentences?: number } = {}
) {
  const maxTokens = options.maxTokens || 512;
  const overlapSentences = options.overlapSentences ?? 1;

  const chunks: { text: string; tokenCount: number; pageNumbers: number[] }[] = [];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageNumber = pageIdx + 1;
    const sentences = pages[pageIdx]
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let currentSentences: string[] = [];
    let currentTokens = 0;

    const flush = () => {
      if (currentSentences.length === 0) return;
      const text = currentSentences.join(' ');
      chunks.push({
        text,
        tokenCount: Math.ceil(text.length / 4),
        pageNumbers: [pageNumber],
      });
      // Carry overlap sentences into the next chunk of this page
      currentSentences = currentSentences.slice(-overlapSentences);
      const overlapText = currentSentences.join(' ');
      currentTokens = Math.ceil(overlapText.length / 4);
    };

    for (const sentence of sentences) {
      const sentenceTokens = Math.ceil(sentence.length / 4);
      if (currentTokens + sentenceTokens > maxTokens && currentSentences.length > overlapSentences) {
        flush();
      }
      currentSentences.push(sentence);
      currentTokens += sentenceTokens;
    }
    flush();
  }

  return chunks;
}

// ==========================================
// GENERATE EMBEDDINGS USING GEMINI
// ==========================================
async function embedOne(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    `${GEMINI_API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Embedding failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.embedding?.values ?? [];
}

async function generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    try {
      // Truncate if too long (gemini-embedding-001 has a 2048-token input limit)
      const truncatedText = text.slice(0, 8000);
      const values = await embedOne(truncatedText, apiKey);
      if (values.length !== 768) {
        throw new Error(`Unexpected embedding dimension: ${values.length}`);
      }
      embeddings.push(values);
    } catch (error) {
      console.error('Failed to generate embedding for text:', error);
      // Re-throw: storing zero vectors would poison search results.
      throw error;
    }
  }

  return embeddings;
}

// ==========================================
// EXTRACT TEXT PER PAGE (real extraction via unpdf/pdf.js)
// ==========================================
async function extractPdfText(pdfBytes: Uint8Array): Promise<{
  pages: string[];
  totalPages: number;
}> {
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));
  const result = await extractText(pdf, { mergePages: false });
  let pages: string[] = Array.isArray(result.text) ? result.text : [result.text];
  pages = pages.map(p => (p || '').trim());
  return { pages, totalPages: result.totalPages ?? pages.length };
}

// Heuristic: a scanned page has almost no extractable text.
function isScannedPage(pageText: string): boolean {
  return pageText.replace(/\s+/g, '').length < 32;
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
      console.error(`Job ${jobId} failed: Insufficient credits (Requires ${estimatedCost}, Available ${accountData?.available || 0})`)
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

    // Create reservation
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

    // Deduct reserved amount from available, add to reserved
    await supabaseClient
      .from('credit_accounts')
      .update({
        available: accountData.available - estimatedCost,
        reserved: (accountData.reserved || 0) + estimatedCost
      })
      .eq('workspace_id', workspaceId)

    // Write to ledger
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

    // Fetch document file from storage
    const { data: docInfo } = await supabaseClient
      .from('documents')
      .select('file_path, name')
      .eq('id', documentId)
      .single()

    if (!docInfo?.file_path) {
      throw new Error('Document file path not found')
    }

    // Download PDF from storage
    const { data: pdfBlob, error: downloadError } = await supabaseClient.storage
      .from('workspace_documents')
      .download(docInfo.file_path)

    if (downloadError || !pdfBlob) {
      throw new Error('Failed to download PDF from storage')
    }

    // ==========================================
    // EXTRACT TEXT PER PAGE (real extraction)
    // ==========================================
    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
    let pages: string[]
    try {
      const extraction = await extractPdfText(pdfBytes)
      pages = extraction.pages

      // Update page count from the real document
      await supabaseClient
        .from('documents')
        .update({ page_count: extraction.totalPages })
        .eq('id', documentId)

      console.log(`Extracted text from ${extraction.totalPages} pages`)
    } catch (extractError: any) {
      throw new Error('PDF text extraction failed: ' + (extractError?.message || 'unknown error'))
    }

    const scannedPages = pages.filter(isScannedPage).length
    if (scannedPages > 0) {
      console.warn(`${scannedPages}/${pages.length} pages appear to be scanned (no text layer). OCR support required for full coverage.`)
    }

    const extractedText = pages
      .map((pageText, idx) => `---PAGE ${idx + 1}---\n${pageText}`)
      .join('\n\n')

    if (extractedText.replace(/\s+/g, '').length < 32) {
      throw new Error('No extractable text found in PDF. The document appears to be fully scanned; OCR processing is required.')
    }

    // Update document with extracted text
    await supabaseClient
      .from('documents')
      .update({
        extracted_text: extractedText,
        text_extracted_at: new Date().toISOString(),
        status: 'processing'
      })
      .eq('id', documentId)

    // ==========================================
    // 3. CHUNK TEXT (page-aware)
    // ==========================================
    const chunks = chunkText(pages, { maxTokens: 512, overlapSentences: 1 });
    console.log(`Created ${chunks.length} chunks for document ${documentId}`);

    // ==========================================
    // 4. GENERATE EMBEDDINGS
    // ==========================================
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await generateEmbeddings(chunkTexts, geminiApiKey);

    // ==========================================
    // 5. STORE EMBEDDINGS AND CHUNKS
    // ==========================================
    const embeddingRows = chunks.map((chunk, i) => ({
      workspace_id: workspaceId,
      document_id: documentId,
      chunk_index: i,
      chunk_text: chunk.text,
      chunk_tokens: chunk.tokenCount,
      embedding: embeddings[i],
      metadata: {
        page_numbers: chunk.pageNumbers,
        // Scalar for hybrid_search's metadata->>'page_number' lookup
        page_number: chunk.pageNumbers[0] ?? null,
      }
    }));

    const { error: embeddingError } = await supabaseClient
      .from('document_embeddings')
      .upsert(embeddingRows, { onConflict: 'document_id,chunk_index' });

    if (embeddingError) {
      console.error('Failed to insert embeddings:', embeddingError);
      throw new Error('Failed to store embeddings: ' + embeddingError.message);
    }

    // Store chunks in the real document_chunks schema (id TEXT PK, content, page_number)
    let chunkCounterByPage: Record<number, number> = {};
    const chunkRows = chunks.map((chunk) => {
      const pageNo = chunk.pageNumbers[0] ?? 1;
      chunkCounterByPage[pageNo] = (chunkCounterByPage[pageNo] ?? 0) + 1;
      return {
        id: `${documentId}_p${pageNo}_c${chunkCounterByPage[pageNo]}`,
        workspace_id: workspaceId,
        document_id: documentId,
        page_number: pageNo,
        content: chunk.text,
        token_count: chunk.tokenCount,
        chunk_type: 'paragraph',
      };
    });

    // Upsert on the natural key (id encodes doc/page/chunk ordinality)
    const { error: chunkError } = await supabaseClient
      .from('document_chunks')
      .upsert(chunkRows, { onConflict: 'id' });

    if (chunkError) {
      console.error('Failed to insert chunks:', chunkError);
      throw new Error('Failed to store chunks: ' + chunkError.message);
    }

    // Update document with embedding info
    await supabaseClient
      .from('documents')
      .update({
        chunk_count: chunks.length,
        embedding_status: 'completed',
        status: 'ready'
      })
      .eq('id', documentId)

    // Thumbnails are rendered client-side by the PDF viewer (no canvas in this runtime).

    // ==========================================
    // 6. SETTLE CREDITS
    // ==========================================
    const actualCost = estimatedCost;

    try {
      // Settle reservation
      await supabaseClient
        .from('credit_reservations')
        .update({
          status: 'confirmed',
          settled_amount: actualCost
        })
        .eq('id', reservationId)

      // Ledger consume entry
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

      // Update account
      const { data: finalAccount } = await supabaseClient
        .from('credit_accounts')
        .select('reserved, consumed, available')
        .eq('workspace_id', workspaceId)
        .single()

      if (finalAccount) {
        const refundAmount = Math.max(0, estimatedCost - actualCost);
        await supabaseClient
          .from('credit_accounts')
          .update({
            reserved: Math.max(0, (finalAccount.reserved || 0) - estimatedCost),
            consumed: (finalAccount.consumed || 0) + actualCost,
            available: (finalAccount.available || 0) + refundAmount
          })
          .eq('workspace_id', workspaceId)
      }

      // If there was a refund, log it to ledger
      const refundAmount = Math.max(0, estimatedCost - actualCost);
      if (refundAmount > 0) {
        await supabaseClient.from('credit_ledger').insert({
          workspace_id: workspaceId,
          entry_type: 'refund',
          amount: refundAmount,
          direction: 1,
          reservation_id: reservationId,
          job_id: jobId
        })
      }
    } catch (settleError: any) {
      console.error('Failed to settle credits:', settleError)
    }

    // Complete Job
    await supabaseClient
      .from('processing_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        processing_time: Math.round((Date.now() - startTime) / 1000),
      })
      .eq('id', jobId)

    console.log(`Job ${jobId} completed successfully in ${Math.round((Date.now() - startTime) / 1000)}s. Cost: ${actualCost} credits.`)

    return new Response(JSON.stringify({ success: true, jobId, cost: actualCost }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Processing job failed:', error)

    // Attempt to refund reserved credits on failure
    try {
      const payload = await req.json().catch(() => ({}))
      const jobId = payload?.record?.id
      if (jobId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Find and update the reservation
        const { data: reservation } = await supabaseClient
          .from('credit_reservations')
          .select('id, reserved_amount, workspace_id')
          .eq('job_id', jobId)
          .eq('status', 'pending')
          .single()

        if (reservation) {
          // Mark reservation as cancelled/refunded
          await supabaseClient
            .from('credit_reservations')
            .update({ status: 'cancelled' })
            .eq('id', reservation.id)

          // Refund the reserved amount
          const { data: account } = await supabaseClient
            .from('credit_accounts')
            .select('available, reserved')
            .eq('workspace_id', reservation.workspace_id)
            .single()

          if (account) {
            await supabaseClient
              .from('credit_accounts')
              .update({
                available: (account.available || 0) + reservation.reserved_amount,
                reserved: Math.max(0, (account.reserved || 0) - reservation.reserved_amount)
              })
              .eq('workspace_id', reservation.workspace_id)
          }

          // Log refund to ledger
          await supabaseClient.from('credit_ledger').insert({
            workspace_id: reservation.workspace_id,
            entry_type: 'refund',
            amount: reservation.reserved_amount,
            direction: 1,
            reservation_id: reservation.id,
            job_id: jobId
          })
        }

        await supabaseClient
          .from('processing_jobs')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown processing error'
          })
          .eq('id', jobId)
      }
    } catch (refundError) {
      console.error('Failed to process refund on job failure:', refundError)
    }

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})