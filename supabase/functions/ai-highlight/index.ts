/**
 * AI Highlight Edge Function (Checkpoint 3)
 *
 * SEMANTIC-ONLY AI selection. The AI NEVER returns coordinates.
 *
 * Input:  { document_id, workspace_id, page_number? (null = whole doc),
 *           segments: [{ segment_key, text, sequence }],  // client-built inventory
 *           density: 'low' | 'normal' | 'high' }
 * Output: { selections: [{ segment_key, category, confidence }],
 *           model, warning? }
 *
 * The client then maps each returned segment_key to its canonical geometry
 * (already stored in document_page_segments) and creates normal highlights
 * with source='ai'. If a segment_key is unknown the client simply ignores
 * that selection — no heuristic geometry is ever invented.
 *
 * Billing is intentionally NOT wired (Checkpoint 3 runs without metering).
 */

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
const GENERATION_MODEL = "gemini-flash-latest"
const FALLBACK_MODEL = "gemini-3.6-flash" // stable model for high-demand periods

/** Call Gemini with one retry on transient errors (429/500/503). */
async function callGemini(apiKey: string, prompt: string): Promise<{ ok: boolean; status: number; text: string }> {
  const attempt = async (model: string) => {
    const res = await fetch(
      `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
    )
    const bodyText = await res.text().catch(() => "")
    return { res, bodyText }
  }

  let { res, bodyText } = await attempt(GENERATION_MODEL)

  // One retry after a short pause on transient upstream failures
  if (!res.ok && [429, 500, 503].includes(res.status)) {
    await new Promise((r) => setTimeout(r, 1500))
    const retry = await attempt(GENERATION_MODEL)
    res = retry.res
    bodyText = retry.bodyText
  }
  // Model-level fallback: try the stable alias before giving up
  if (!res.ok && [429, 500, 503].includes(res.status)) {
    const fb = await attempt(FALLBACK_MODEL)
    res = fb.res
    bodyText = fb.bodyText
  }

  return { ok: res.ok, status: res.status, text: bodyText }
}

const CATEGORY_SET = new Set([
  'idea', 'definition', 'concept', 'date', 'name', 'fact',
  'key-term', 'relationship', 'example', 'summary', 'warning',
])

const DENSITY_GUIDANCE: Record<string, string> = {
  low: 'Be extremely selective: only the few segments a reader absolutely cannot miss. At most 2 selections per page.',
  normal: 'Select the important segments: main ideas, key definitions, critical facts. Around 3-5 selections per page.',
  high: 'Be thorough: all useful study material including supporting details, examples and secondary facts. Up to 8 selections per page.',
}

interface SegmentInput {
  segment_key: string
  text: string
  sequence: number
}

interface AIHighlightRequest {
  document_id: string
  workspace_id: string
  page_number?: number | null
  segments: SegmentInput[]
  density?: 'low' | 'normal' | 'high'
}

function buildPrompt(req: AIHighlightRequest): string {
  const scope = req.page_number
    ? `The user wants the CURRENT PAGE (page ${req.page_number}) highlighted.`
    : 'The user wants the WHOLE DOCUMENT (the segments below span multiple pages; their key is prefixed with p<page>).'
  const density = DENSITY_GUIDANCE[req.density ?? 'normal'] ?? DENSITY_GUIDANCE.normal

  const inventory = req.segments
    .map((s) => `${s.segment_key}\t${s.text.replace(/\t|\n/g, ' ').substring(0, 300)}`)
    .join('\n')

  return `You are a study assistant that selects which text segments of a document are worth highlighting.

${scope}
${density}

You receive a numbered inventory of text segments (key TAB text). Choose the segments that contain:
- main ideas and arguments
- definitions and key concepts
- important dates, names, and facts
- critical data, formulas, or conclusions
- study-worthy phrases

Rules:
1. Return ONLY a JSON array. No markdown, no explanation, no code fences.
2. Each element: { "segment_key": "<exact key from the inventory>", "category": "<one of: idea|definition|concept|date|name|fact|key-term|relationship|example|summary|warning>", "confidence": <0.0-1.0> }
3. Copy segment_key EXACTLY as given. Never invent keys. Never output x/y/width/height — you have no geometry information.
4. Prefer FEWER, higher-value selections over many shallow ones.
5. Do not select consecutive segments that could have been one — pick the best one.

SEGMENT INVENTORY:
${inventory}`
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

    // ─── Authentication ───
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Parse Request ───
    const payload: AIHighlightRequest = await req.json()
    const { document_id, workspace_id, segments } = payload

    if (!document_id || !workspace_id || !Array.isArray(segments)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: document_id, workspace_id, segments' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (segments.length === 0) {
      return new Response(JSON.stringify({ selections: [], model: GENERATION_MODEL, warning: 'No text segments provided for this scope.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    // ─── Verify Workspace Membership ───
    const { data: membership } = await supabaseClient
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    // ─── Verify Document Access ───
    const { data: doc } = await supabaseClient
      .from('documents')
      .select('id, workspace_id, name')
      .eq('id', document_id)
      .single()

    if (!doc || doc.workspace_id !== workspace_id) {
      return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: corsHeaders })
    }

    // ─── Billing intentionally NOT wired in Checkpoint 3 ───

    // ─── Cap inventory size to protect the prompt ───
    const MAX_SEGMENTS = 400
    const inventory = segments.length > MAX_SEGMENTS
      ? segments.slice(0, MAX_SEGMENTS)
      : segments

    // ─── Call Gemini directly (same pattern as generate-knowledge) ───
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI service is not configured. The document remains fully readable.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = buildPrompt({ ...payload, segments: inventory })

    const gen = await callGemini(apiKey, prompt)
    if (!gen.ok) {
      console.error('ai-highlight Gemini error:', gen.status, gen.text.slice(0, 300))
      const quota = gen.status === 429
      return new Response(JSON.stringify({
        error: quota || gen.status === 503
          ? 'El servicio de IA está saturado en este momento. Tu documento sigue siendo totalmente legible — probá de nuevo en unos segundos.'
          : `AI request failed (${gen.status}).`
      }), { status: quota ? 429 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let responseText = ''
    try {
      const genJson = JSON.parse(gen.text)
      responseText = (
        genJson.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? ""
      ).trim()
    } catch {
      responseText = gen.text.trim()
    }

    // ─── Parse AI Response ───
    let parsed: Array<{ segment_key?: string; category?: string; confidence?: number }>
    try {
      const cleaned = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      parsed = JSON.parse(cleaned)
      if (!Array.isArray(parsed)) throw new Error('Expected JSON array')
    } catch {
      console.error('ai-highlight: malformed AI response:', responseText.slice(0, 500))
      return new Response(JSON.stringify({ error: 'The AI returned an unexpected format. Please try again.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── Validate against the provided inventory (the AI can only pick keys we sent) ───
    const validKeys = new Set(inventory.map((s) => s.segment_key))
    const selections = parsed
      .filter((s) => typeof s.segment_key === 'string' && validKeys.has(s.segment_key))
      .map((s) => ({
        segment_key: s.segment_key as string,
        category: typeof s.category === 'string' && CATEGORY_SET.has(s.category) ? s.category : 'idea',
        confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.8,
      }))

    // Deduplicate by segment_key keeping the first occurrence
    const seen = new Set<string>()
    const unique = selections.filter((s) => {
      if (seen.has(s.segment_key)) return false
      seen.add(s.segment_key)
      return true
    })

    return new Response(JSON.stringify({
      selections: unique,
      model: GENERATION_MODEL,
      analyzed_segments: inventory.length,
      doc_title: doc.name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('ai-highlight error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Unexpected AI error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
