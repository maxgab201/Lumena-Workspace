import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.2.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPTS: Record<string, (docTitle: string, extract: string) => string> = {
  flashcards: (title, extract) => `You are an expert educator. Based on the following document excerpt from "${title}", generate 8-10 high-quality flashcards for studying.

DOCUMENT EXCERPT:
${extract}

Respond ONLY with a valid JSON array of objects. Each object must have exactly:
{ "front": "question or concept", "back": "answer or explanation" }

Do not include any explanatory text, markdown, or code fences. Only the raw JSON array.`,

  glossary: (title, extract) => `You are an expert in knowledge extraction. Based on the following document excerpt from "${title}", identify and define the 8-12 most important technical terms, concepts, or specialized vocabulary.

DOCUMENT EXCERPT:
${extract}

Respond ONLY with a valid JSON array of objects. Each object must have exactly:
{ "term": "term name", "definition": "clear and concise definition" }

Do not include any explanatory text, markdown, or code fences. Only the raw JSON array.`,

  mindmap: (title, extract) => `You are an expert at structuring information. Based on the following document excerpt from "${title}", create a hierarchical mind map.

DOCUMENT EXCERPT:
${extract}

Respond ONLY with a valid JSON array of nodes. The first node should be the root (central topic).
Each object must have exactly: { "label": "node label", "parent_label": null or "parent node label" }
The root node must have parent_label: null. All other nodes reference a parent by its label.
Limit to 12-15 nodes total.

Do not include any explanatory text, markdown, or code fences. Only the raw JSON array.`,
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
    const { document_id, workspace_id, action_type } = payload

    if (!document_id || !workspace_id || !action_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields: document_id, workspace_id, action_type' }), { status: 400, headers: corsHeaders })
    }

    if (!['flashcards', 'glossary', 'mindmap'].includes(action_type)) {
      return new Response(JSON.stringify({ error: 'Invalid action_type. Must be flashcards, glossary, or mindmap.' }), { status: 400, headers: corsHeaders })
    }

    // Verify workspace membership
    const { data: membership } = await supabaseClient
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // Fetch document metadata for title and extract
    const { data: doc } = await supabaseClient
      .from('documents')
      .select('name, extracted_text')
      .eq('id', document_id)
      .single()

    if (!doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: corsHeaders })
    }

    // Use extracted text or a placeholder
    const extractedText = doc.extracted_text || ''
    if (!extractedText || extractedText.trim().length < 50) {
      return new Response(JSON.stringify({ error: 'Document has insufficient extracted text for AI generation. Please ensure the document has been fully processed.' }), { status: 422, headers: corsHeaders })
    }

    // Limit to first 8000 chars to stay within token limits
    const excerpt = extractedText.substring(0, 8000)

    // Check credits
    const { data: account } = await supabaseClient
      .from('credit_accounts')
      .select('available')
      .eq('workspace_id', workspace_id)
      .single()

    if (!account || account.available < 10) {
      return new Response(JSON.stringify({ error: 'Insufficient credits for knowledge generation.' }), { status: 402, headers: corsHeaders })
    }

    // Generate with Gemini
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured.' }), { status: 500, headers: corsHeaders })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const promptFn = PROMPTS[action_type]
    const prompt = promptFn(doc.name, excerpt)

    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()

    // Parse the JSON response
    let parsed: any[]
    try {
      // Strip code fences if model adds them despite instructions
      const cleaned = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array')
    } catch (_) {
      console.error('Failed to parse AI response:', responseText)
      return new Response(JSON.stringify({ error: 'AI returned malformed JSON. Please try again.' }), { status: 500, headers: corsHeaders })
    }

    // Persist to DB based on action type
    let inserted: any[] = []

    if (action_type === 'flashcards') {
      const rows = parsed.map((item: any) => ({
        document_id,
        workspace_id,
        front: String(item.front ?? '').trim(),
        back: String(item.back ?? '').trim(),
      })).filter(r => r.front && r.back)

      const { data, error } = await supabaseClient.from('flashcards').insert(rows).select()
      if (error) throw error
      inserted = data ?? []

    } else if (action_type === 'glossary') {
      const rows = parsed.map((item: any) => ({
        document_id,
        workspace_id,
        term: String(item.term ?? '').trim(),
        definition: String(item.definition ?? '').trim(),
      })).filter(r => r.term && r.definition)

      const { data, error } = await supabaseClient.from('glossary_terms').insert(rows).select()
      if (error) throw error
      inserted = data ?? []

    } else if (action_type === 'mindmap') {
      // First insert root node, then children (need IDs to set parent_id)
      const root = parsed.find((n: any) => !n.parent_label)
      const children = parsed.filter((n: any) => !!n.parent_label)

      if (!root) {
        return new Response(JSON.stringify({ error: 'Mind map must have a root node with parent_label: null' }), { status: 422, headers: corsHeaders })
      }

      const { data: rootData, error: rootErr } = await supabaseClient
        .from('mind_map_nodes')
        .insert({ document_id, workspace_id, label: String(root.label).trim(), parent_id: null, position_x: 0, position_y: 0 })
        .select()
        .single()

      if (rootErr || !rootData) throw rootErr ?? new Error('Failed to insert root node')
      inserted.push(rootData)

      // Insert children with root as parent (simple flat layout for now)
      const childRows = children.map((child: any, i: number) => ({
        document_id,
        workspace_id,
        label: String(child.label).trim(),
        parent_id: rootData.id,
        position_x: (i % 4) * 200 - 300,
        position_y: Math.floor(i / 4) * 150 + 150,
      }))

      if (childRows.length > 0) {
        const { data: childData, error: childErr } = await supabaseClient
          .from('mind_map_nodes')
          .insert(childRows)
          .select()
        if (childErr) throw childErr
        inserted.push(...(childData ?? []))
      }
    }

    // Deduct credits (10 credits per generation)
    const GENERATION_COST = 10
    await supabaseClient.from('credit_accounts').update({
      available: account.available - GENERATION_COST,
      consumed: (account as any).consumed + GENERATION_COST,
    }).eq('workspace_id', workspace_id)

    await supabaseClient.from('credit_ledger').insert({
      workspace_id,
      entry_type: 'consume',
      amount: GENERATION_COST,
      direction: -1,
    })

    return new Response(JSON.stringify({ items: inserted, count: inserted.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('generate-knowledge error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
