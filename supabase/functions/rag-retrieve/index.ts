import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { EmbeddingHttpError, classifyEmbeddingFailure } from "../_shared/embeddings.ts"
import { andTsQuery, chunkIndexOf, keywordTerms, orTsQuery, rankKeywordChunks } from "../_shared/keywordSearch.ts"
import { normalizeHybridRows, retrieveWithFallback, type RetrievedRow } from "../_shared/ragFallback.ts"

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
const EMBEDDING_MODEL = "gemini-embedding-001" // 768 dims by default

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
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
  )
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new EmbeddingHttpError(classifyEmbeddingFailure(res.status, body))
  }
  const json = await res.json()
  return json.embedding?.values ?? []
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RetrievalRequest {
  query: string;
  workspace_id: string;
  document_id?: string;
  limit?: number;
  similarity_threshold?: number;
  semantic_weight?: number;
  keyword_weight?: number;
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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const payload: RetrievalRequest = await req.json()
    const { query, workspace_id, document_id, limit = 10, similarity_threshold = 0.7, semantic_weight = 0.7, keyword_weight = 0.3 } = payload

    if (!query || !workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing query or workspace_id' }), { status: 400, headers: corsHeaders })
    }

    // Verify user has access to workspace
    const { data: membership } = await supabaseClient
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // ==========================================
    // 1-2. SEMANTIC SEARCH, WITH A TEXT FALLBACK
    // ==========================================
    // Semantic search needs the embedding provider twice: the document's chunks must have been
    // embedded, and the query is embedded here at request time. When the provider is out of quota,
    // or the document was never indexed, answer from the stored text instead of failing: chat and
    // search keep working, just without semantic ranking.
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

    const semantic = async (): Promise<RetrievedRow[]> => {
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured')
      // Truncate query if too long
      const queryEmbedding = await embedQuery(query.slice(0, 8000), geminiApiKey)
      const { data, error } = await supabaseClient.rpc('hybrid_search', {
        p_workspace_id: workspace_id,
        p_query_text: query,
        p_query_embedding: queryEmbedding,
        p_limit: limit,
        p_semantic_weight: semantic_weight,
        p_keyword_weight: keyword_weight,
        p_document_ids: document_id ? [document_id] : null,
        p_min_similarity: similarity_threshold,
      })
      if (error) throw new Error('Search failed: ' + error.message)
      return normalizeHybridRows(data ?? [])
    }

    const hasEmbeddings = async (): Promise<boolean> => {
      let count = supabaseClient
        .from('document_embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id)
      if (document_id) count = count.eq('document_id', document_id)
      const { count: total } = await count
      return (total ?? 0) > 0
    }

    const keyword = async (): Promise<RetrievedRow[]> => {
      const terms = keywordTerms(query)
      if (terms.length === 0) return []
      const candidates = async (tsquery: string) => {
        let q = supabaseClient
          .from('document_chunks')
          .select('id, document_id, page_number, content, chunk_type')
          .eq('workspace_id', workspace_id)
          .textSearch('search_vector', tsquery, { config: 'simple' })
          .limit(200)
        if (document_id) q = q.eq('document_id', document_id)
        const { data, error } = await q
        if (error) throw new Error('Keyword search failed: ' + error.message)
        return data ?? []
      }
      // Chunks with every term first; then any term, to fill up to the limit.
      const found = new Map<string, { id: string; document_id: string; page_number: number; content: string; chunk_type: string }>()
      if (terms.length > 1) for (const chunk of await candidates(andTsQuery(terms))) found.set(chunk.id, chunk)
      if (found.size < limit) for (const chunk of await candidates(orTsQuery(terms))) found.set(chunk.id, chunk)
      return rankKeywordChunks([...found.values()], terms, limit).map((chunk) => ({
        document_id: chunk.document_id,
        chunk_index: chunkIndexOf(chunk.id),
        chunk_text: chunk.content,
        similarity: 0,
        keyword_rank: chunk.score,
        combined_score: chunk.score,
        page_number: chunk.page_number,
        chunk_type: chunk.chunk_type ?? 'paragraph',
      }))
    }

    const outcome = await retrieveWithFallback({
      semantic,
      hasEmbeddings,
      keyword,
      onSemanticFailure: (error) => console.warn('Semantic search unavailable, answering from stored text:', error instanceof Error ? error.message : error),
    })
    const results = outcome.rows
    const degraded = outcome.mode === 'keyword' ? { mode: 'keyword', reason: outcome.degradedReason } : null

    // ==========================================
    // 3. FETCH DOCUMENT NAMES FOR RESULTS
    // ==========================================
    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ results: [], query, degraded }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const docIds = [...new Set(results.map((r) => r.document_id))]
    const { data: documents } = await supabaseClient
      .from('documents')
      .select('id, name')
      .in('id', docIds)

    const docNameMap = new Map(documents?.map(d => [d.id, d.name]) || [])

    // ==========================================
    // 4. LOG SEARCH QUERY FOR ANALYTICS
    // ==========================================
    try {
      await supabaseClient.from('search_queries').insert({
        workspace_id,
        user_id: user.id,
        query_text: query,
        search_type: outcome.mode,
        filters: { document_id: document_id || null, similarity_threshold, semantic_weight, keyword_weight },
        results_count: results.length,
      })
    } catch {
      // Don't fail if logging fails
    }

    // ==========================================
    // 5. RETURN RESULTS WITH CITATION METADATA
    // ==========================================
    const enrichedResults = results.map((r) => ({
      ...r,
      document_name: docNameMap.get(r.document_id) || 'Unknown Document',
      // Include metadata needed for future citations
      citation: {
        document_id: r.document_id,
        document_name: docNameMap.get(r.document_id) || 'Unknown Document',
        page_number: r.page_number,
        chunk_index: r.chunk_index,
        chunk_text: r.chunk_text,
        similarity: r.similarity,
        match_type: outcome.mode === 'keyword' ? 'keyword' : (r.combined_score > 0 ? 'hybrid' : 'keyword'),
      }
    }))

    return new Response(JSON.stringify({ results: enrichedResults, query, degraded }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('RAG retrieve error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})