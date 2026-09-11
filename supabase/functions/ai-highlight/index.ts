/**
 * AI Highlight Edge Function (Checkpoint 3 — semantic quality rework)
 *
 * SEMANTIC-ONLY AI selection. The AI NEVER returns coordinates.
 *
 * Input:  { document_id, workspace_id, page_number?, sentences: [keys+text],
 *           density: 'low' | 'normal' | 'high' }
 * Output: { selections: [{ sentence_key, quote, category, confidence }],
 *           model, analyzed_sentences }
 *
 * The AI picks WHOLE SENTENCES from the inventory, then narrows each pick to
 * the exact substring (quote) that matters. The client validates that every
 * quote really exists inside its sentence (strict normalization) and maps it
 * to real word geometry — quotes that don't match are silently dropped, never
 * approximated. No geometry is ever invented by the model.
 *
 * Selection quality rules (mirrored from the prompt):
 *   - coverage budget per density (less, but better)
 *   - noise rejection (titles, footers, page numbers, connectors)
 *   - category discipline (few, meaningful categories)
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
          generationConfig: { temperature: 0.15, responseMimeType: "application/json" },
        }),
      },
    )
    const bodyText = await res.text().catch(() => "")
    return { res, bodyText }
  }

  let { res, bodyText } = await attempt(GENERATION_MODEL)
  // High-demand windows can last a few seconds — retry with growing backoff.
  if (!res.ok && [429, 500, 503].includes(res.status)) {
    await new Promise((r) => setTimeout(r, 2000))
    const retry = await attempt(GENERATION_MODEL)
    res = retry.res
    bodyText = retry.bodyText
  }
  if (!res.ok && [429, 500, 503].includes(res.status)) {
    await new Promise((r) => setTimeout(r, 4000))
    const retry2 = await attempt(GENERATION_MODEL)
    res = retry2.res
    bodyText = retry2.bodyText
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
  'main_idea', 'definition', 'key_fact', 'date', 'person', 'formula',
])

const DENSITY_BUDGET: Record<string, { minPct: number; maxPct: number; maxPer1000Words: number }> = {
  // Coverage of the page's useful text — guidelines, never a quota.
  low:    { minPct: 4,  maxPct: 10, maxPer1000Words: 12 },
  normal: { minPct: 8,  maxPct: 18, maxPer1000Words: 25 },
  high:   { minPct: 15, maxPct: 30, maxPer1000Words: 45 },
}

interface SentenceInput {
  sentence_key: string
  text: string
}

interface AIHighlightRequest {
  document_id: string
  workspace_id: string
  page_number?: number | null
  sentences: SentenceInput[]
  density?: 'low' | 'normal' | 'high'
}

const COMMON_NOISE = [
  'page', 'página', 'copyright', 'all rights reserved', 'www.', 'http',
  'doi:', 'isbn', 'vol.', 'fig.', 'figure', 'tabla', 'table',
]

/** Heuristic pre-filter: obvious non-content lines never reach the model. */
function isNoise(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length < 12) return true // "42", "Chapter 3", "Fig. 1"
  if (/^\d+$/.test(t)) return true
  if (COMMON_NOISE.some((n) => t.includes(n)) && t.length < 60) return true
  const letters = t.replace(/[^a-záéíóúñüäöß]/g, '')
  if (letters.length < t.length * 0.5) return true // mostly numbers/symbols
  return false
}

function buildPrompt(req: AIHighlightRequest): string {
  const scope = req.page_number
    ? `The user wants the CURRENT PAGE (page ${req.page_number}) highlighted.`
    : 'The user wants the WHOLE DOCUMENT — each sentence below belongs to one page (keys are prefixed p<page>).'
  const budget = DENSITY_BUDGET[req.density ?? 'normal'] ?? DENSITY_BUDGET.normal

  const inventory = req.sentences
    .map((s) => `${s.sentence_key}\t${s.text.replace(/\t|\n/g, ' ').substring(0, 400)}`)
    .join('\n')

  return `You are an expert study partner highlighting a document for a student. Act like a careful reader: mark ONLY what the student would genuinely need to remember or review later.

${scope}

SELECTION RULES (follow strictly):
1. Highlight LESS, but BETTER. A precise fragment of one great sentence beats many vague ones. It is fine — even good — to return very few or zero selections for a page with little real content.
2. Select the SPECIFIC fragment inside a sentence, not the whole sentence, when only part of it matters. The "quote" must be copied VERBATIM from that sentence (same language, same words, no paraphrase, no translation).
3. Prioritize (in order): main ideas and arguments · definitions of key concepts · cause/effect relationships · essential facts, names, dates and figures · formulas or data a student must recall.
4. NEVER select: titles or headings · page numbers, headers/footers · pure connectors or empty introductions ("In this chapter we will...") · trivia or filler · repeated statements of the same idea.
5. Category must be exactly one of: main_idea | definition | key_fact | date | person | formula.
6. Coverage guideline for this run: roughly ${budget.minPct}–${budget.maxPct}% of the meaningful text. Do NOT pad to reach it.

OUTPUT — return ONLY a JSON array (no markdown, no prose). Each element:
{ "sentence_key": "<exact key from the inventory>", "quote": "<verbatim fragment copied from that sentence>", "category": "<one of the six categories>", "confidence": <0.0-1.0> }

Rules: copy sentence_key exactly · the quote MUST appear character-for-character (after collapsing whitespace) inside that sentence · never invent keys or coordinates (you have no geometry) · at most one selection per sentence · drop a selection rather than guess.

SENTENCES:
${inventory}`
}

/** Token-overlap redundancy check between two normalized quotes. */
function isRedundant(a: string, b: string): boolean {
  const A = new Set(a.toLowerCase().split(/\s+/))
  const B = new Set(b.toLowerCase().split(/\s+/))
  if (A.size === 0 || B.size === 0) return false
  const overlap = [...A].filter((w) => B.has(w)).length
  return overlap / Math.min(A.size, B.size) >= 0.75
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

    const payload: AIHighlightRequest = await req.json()
    const { document_id, workspace_id, sentences, density = 'normal' } = payload

    if (!document_id || !workspace_id || !Array.isArray(sentences)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: document_id, workspace_id, sentences' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (sentences.length === 0) {
      return new Response(JSON.stringify({ selections: [], model: GENERATION_MODEL }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    const { data: membership } = await supabaseClient
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
    }

    const { data: doc } = await supabaseClient
      .from('documents')
      .select('id, workspace_id, name')
      .eq('id', document_id)
      .single()
    if (!doc || doc.workspace_id !== workspace_id) {
      return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: corsHeaders })
    }

    // ─── Pre-filter noise, cap prompt size ───
    const contentful = sentences.filter((s) => !isNoise(s.text))
    const MAX_SENTENCES = 220
    const inventory = contentful.length > MAX_SENTENCES ? contentful.slice(0, MAX_SENTENCES) : contentful
    if (inventory.length === 0) {
      return new Response(JSON.stringify({ selections: [], model: GENERATION_MODEL, note: 'no contentful sentences' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI service is not configured. The document remains fully readable.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = buildPrompt({ ...payload, sentences: inventory })
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

    let parsed: Array<{ sentence_key?: string; quote?: string; category?: string; confidence?: number }>
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

    // ─── STRICT validation: the quote must exist inside its sentence ───
    const byKey = new Map(inventory.map((s) => [s.sentence_key, s.text]))
    const norm = (v: string) => v.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

    interface Candidate {
      sentence_key: string
      quote: string
      category: string
      confidence: number
      rank: number
    }
    const candidates: Candidate[] = []
    const seenKeys = new Set<string>()

    for (const sel of parsed) {
      const key = typeof sel.sentence_key === 'string' ? sel.sentence_key : ''
      const quote = typeof sel.quote === 'string' ? sel.quote.trim() : ''
      if (!key || !quote || seenKeys.has(key)) continue
      const sentenceText = byKey.get(key)
      if (!sentenceText) continue // invented key → drop

      // Quote must genuinely appear in the sentence (whitespace-insensitive)
      if (!norm(sentenceText).includes(norm(quote))) {
        console.warn('ai-highlight: dropping unverifiable quote for', key, JSON.stringify(quote.slice(0, 60)))
        continue
      }
      if (norm(quote).length < 8) continue // too short to be meaningful

      seenKeys.add(key)
      candidates.push({
        sentence_key: key,
        quote,
        category: typeof sel.category === 'string' && CATEGORY_SET.has(sel.category) ? sel.category : 'key_fact',
        confidence: typeof sel.confidence === 'number' ? Math.max(0, Math.min(1, sel.confidence)) : 0.75,
        rank: candidates.length,
      })
    }

    // ─── Ranking: confidence first, then model order (narrative priority) ───
    candidates.sort((a, b) => (b.confidence - a.confidence) || (a.rank - b.rank))

    // ─── Redundancy filter (token overlap ≥ 0.75 on shorter side) ───
    const kept: Candidate[] = []
    for (const cand of candidates) {
      const dup = kept.some((k) =>
        k.sentence_key === cand.sentence_key ||
        isRedundant(k.quote, cand.quote)
      )
      if (!dup) kept.push(cand)
    }

    // ─── Coverage budget: enforce the density's maximum share of text.
    // The budget is a ceiling on over-highlighting, not a quota: short pages
    // keep their few best selections (guaranteed minimum of 3 when the model
    // proposed them), long pages get trimmed once the share is exceeded.
    const budget = DENSITY_BUDGET[density] ?? DENSITY_BUDGET.normal
    const totalChars = inventory.reduce((sum, s) => sum + s.text.length, 0)
    const maxChars = Math.max((budget.maxPct / 100) * totalChars, 500)
    const GUARANTEED = 3
    const final: Candidate[] = []
    let usedChars = 0
    for (const cand of kept) {
      const qLen = cand.quote.length
      if (final.length >= GUARANTEED && usedChars + qLen > maxChars) continue
      final.push(cand)
      usedChars += qLen
    }

    return new Response(JSON.stringify({
      selections: final.map(({ sentence_key, quote, category, confidence }) => ({
        sentence_key, quote, category, confidence,
      })),
      model: GENERATION_MODEL,
      analyzed_sentences: inventory.length,
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
