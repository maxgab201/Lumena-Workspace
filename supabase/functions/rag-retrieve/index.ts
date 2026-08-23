import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.2.1"

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

interface RetrievalResult {
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
  keyword_rank: number;
  combined_score: number;
  page_number: number;
  chunk_type: string;
  document_name: string;
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
    // 1. GENERATE QUERY EMBEDDING
    // ==========================================
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: corsHeaders })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'embedding-001' })

    // Truncate query if too long
    const truncatedQuery = query.slice(0, 8000)
    const embeddingResult = await model.embedContent(truncatedQuery)
    const queryEmbedding = embeddingResult.embedding.values

    // ==========================================
    // 2. CALL HYBRID SEARCH FUNCTION
    // ==========================================
    const { data: results, error: searchError } = await supabaseClient.rpc('hybrid_search', {
      p_workspace_id: workspace_id,
      p_query_text: query,
      p_query_embedding: queryEmbedding,
      p_limit: limit,
      p_semantic_weight: semantic_weight,
      p_keyword_weight: keyword_weight,
      p_document_ids: document_id ? [document_id] : null,
      p_min_similarity: similarity_threshold,
    })

    if (searchError) {
      console.error('Hybrid search error:', searchError)
      return new Response(JSON.stringify({ error: 'Search failed: ' + searchError.message }), { status: 500, headers: corsHeaders })
    }

    // ==========================================
    // 3. FETCH DOCUMENT NAMES FOR RESULTS
    // ==========================================
    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ results: [], query }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const docIds = [...new Set(results.map((r: RetrievalResult) => r.document_id))]
    const { data: documents } = await supabaseClient
      .from('documents')
      .select('id, name')
      .in('id', docIds)

    const docNameMap = new Map(documents?.map(d => [d.id, d.name]) || [])

    // ==========================================
    // 4. LOG SEARCH QUERY FOR ANALYTICS
    // ==========================================
    await supabaseClient.from('search_queries').insert({
      workspace_id,
      user_id: user.id,
      query_text: query,
      search_type: 'hybrid',
      filters: { document_id: document_id || null, similarity_threshold, semantic_weight, keyword_weight },
      results_count: results.length,
    }).catch(() => {}) // Don't fail if logging fails

    // ==========================================
    // 5. RETURN RESULTS WITH CITATION METADATA
    // ==========================================
    const enrichedResults = results.map((r: RetrievalResult) => ({
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
        match_type: r.combined_score > 0 ? 'hybrid' : 'keyword',
      }
    }))

    return new Response(JSON.stringify({ results: enrichedResults, query }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('RAG retrieve error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})