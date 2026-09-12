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

  return `You are the semantic highlighting engine for Lumena Workspace.

Your job is NOT to summarize the document.
Your job is NOT to highlight as much text as possible.
Your job is to behave like an excellent student, researcher, and careful reader who has understood the material and is deciding exactly which original fragments are worth marking for later review.

You receive structured text extracted from a PDF.
Every candidate sentence has a stable key. You may only select text that exists verbatim inside the supplied units.
The application, not you, controls geometry.
NEVER generate coordinates, bounding boxes, page positions, or approximate locations.
You select semantic text only.
The application will map the exact quotation back to real PDF words and geometry.

━━━ PRIMARY OBJECTIVE ━━━

Choose the smallest self-contained portions of the original text that preserve the important meaning.

A good highlight should answer: "If the reader returned to this document tomorrow and only looked at the highlighted fragments, would these markings help them quickly recover the central ideas and information worth remembering?"

Highlight less, but better.
Do not mark text merely because it sounds academic.
Do not try to fill a quota.
Zero highlights is valid when the provided content contains nothing worth marking.

━━━ WHAT DESERVES A HIGHLIGHT ━━━

Prioritize, in roughly this order:

1. CENTRAL IDEAS — statements that express the main concept, argument, principle, mechanism, result, or conclusion of a section.

2. DEFINITIONS — precise explanations of what a term, concept, process, phenomenon, object, or theory means. Prefer preserving both the concept being defined AND the essential definition when removing the term would make the highlight ambiguous.

3. CAUSE AND EFFECT — statements explaining why something happens, what produces an outcome, or what consequence follows. Whenever practical, preserve enough of both cause and effect so the highlight makes sense independently.

4. MECHANISMS AND PROCESSES — important descriptions of how something works or the essential stages of a process. Do not highlight every procedural step unless those steps are necessary to understand the mechanism.

5. KEY RELATIONSHIPS AND COMPARISONS — important contrasts, dependencies, classifications, or relationships between concepts.

6. IMPORTANT FACTS — facts that are central to understanding the subject or are likely to matter for study/review. Do not select trivia merely because it is factual.

7. DATES — select a date ONLY when the date itself matters, and normally keep it attached to the event/person/fact it describes.
   Bad: "1882"
   Better: "Walther Flemming described mitosis in 1882" when that complete relation is what matters.

8. PEOPLE — highlight people only when their identity matters to the topic and they are associated with an important discovery, event, theory, work, or action. Do not highlight names simply because they appear.

9. FORMULAS / NUMERIC VALUES — highlight when they are important for understanding, remembering, comparing, or solving something. Preserve enough surrounding text to understand what the number/formula represents.

━━━ WHAT NOT TO HIGHLIGHT ━━━

Do NOT highlight:
- page numbers, headers, footers, copyright notices, navigation or decorative text
- repeated section labels, bibliography/reference noise
- captions that provide no useful information
- generic introductory language, transition phrases, obvious filler, rhetorical wording
- redundant explanations, isolated pronouns
- partial clauses that lose meaning outside the sentence
- examples that add no important concept
- facts that are technically correct but irrelevant to the main subject
- entire paragraphs merely because several sentences are useful
- entire sentences when a shorter exact fragment communicates the same useful idea

━━━ CONTEXTUAL COMPLETENESS ━━━

A highlight must remain understandable when seen later without reading the entire paragraph.
Do NOT make fragments so short that they lose their subject or meaning.

Bad: "reduces it by half"
Better: "meiosis reduces the number of chromosomes by half"

Bad: "was discovered in 1882"
Better: "mitosis was described by Walther Flemming in 1882"

Bad: "genetically identical"
Better: "produces two genetically identical daughter cells"

The goal is NOT the shortest possible quote. The goal is: the shortest quote that remains semantically complete.

━━━ EXACT QUOTATION ━━━

Every quote MUST be copied verbatim from the supplied source sentence.
NEVER: paraphrase · translate · correct grammar · change spelling · rewrite punctuation · invent missing words · combine non-contiguous fragments into one quote.

If the exact useful idea cannot be represented by a contiguous quotation from one supplied sentence, either choose the best valid contiguous fragment or do not select it.

━━━ LANGUAGE ━━━

The source may be English, Spanish, or another language.
Do not translate. Understand the source in its original language. Return the quote exactly as written.
Your selection criteria remain the same regardless of language.

━━━ GRANULARITY ━━━

Avoid two extremes:
TOO LARGE: marking entire lines, sentences, or paragraphs unnecessarily.
TOO SMALL: marking fragments that become meaningless.

Example — source: "Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose."
Poor: "Photosynthesis" · Poor: "convert light energy" · Poor: the whole surrounding paragraph.
Good: "Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose."
(because this is a compact definition and removing more would damage the meaning)

Another source: "Water is composed of two hydrogen atoms and one oxygen atom, and it is essential for many biological processes."
If the relevant fact is composition:
Good: "two hydrogen atoms and one oxygen atom"
(there is no need to highlight the unrelated second clause)

━━━ REDUNDANCY ━━━

Do not select several fragments that communicate essentially the same information.
If two candidates overlap heavily in meaning, choose the stronger, clearer, or more complete one.

━━━ DENSITY MODES ━━━

The user selected: ${req.density ?? 'normal'}.
These are GUIDELINES, not quotas. Never add weak highlights merely to reach a target.
Typical coverage: approximately ${budget.minPct}–${budget.maxPct}% of the useful text.

LOW/POCO — only the most essential: central ideas, essential definitions, extremely important facts. Returning zero or one highlight is completely valid.
NORMAL — a balanced study-friendly set: central ideas, important definitions, major cause/effect, important mechanisms, notable facts. Still be selective.
HIGH/MUCHO — detailed study coverage without turning the page into a marker-covered wall: may include supporting facts, useful secondary details, additional mechanisms, notable names/dates. Even HIGH must avoid filler, repetition, and irrelevant material.

THERE IS NO MINIMUM NUMBER OF HIGHLIGHTS. A page with one important idea may receive one highlight. A page with no meaningful study content must receive zero.

━━━ HEADINGS ━━━

A heading alone is usually NOT useful to highlight ("CELL DIVISION" should normally not be selected).
However, if a heading itself contains substantive information rather than being merely a label, it may be selected.

━━━ EXAMPLES AND LISTS ━━━

Highlight examples only if they clarify an otherwise difficult principle, are explicitly important, or are likely to be studied themselves.
For lists: select individual important list items, not the whole list. If a list only makes sense with its introductory phrase, preserve enough context.

━━━ CONFIDENCE ━━━

Return confidence as a value from 0 to 1 representing: "How confident are you that this exact fragment deserves to be highlighted for later study?"
0.90–1.00: essential / extremely strong selection
0.75–0.89: clearly useful
0.60–0.74: useful but secondary
Below 0.60: normally do not return the candidate

━━━ CATEGORIES ━━━

Use ONLY: main_idea | definition | key_fact | date | person | formula
Choose the category describing WHY the fragment deserves highlighting. If multiple could apply, choose the most educationally useful one.

━━━ SELECTION PROCEDURE ━━━

Before producing output:
STEP 1 — Understand the topic and purpose of the supplied text.
STEP 2 — Identify the central ideas.
STEP 3 — Identify definitions, mechanisms, relationships, important facts, and relevant dates/names/formulas.
STEP 4 — Remove low-value candidates.
STEP 5 — Shorten remaining candidates to the smallest semantically complete exact quote.
STEP 6 — Remove redundant/overlapping candidates.
STEP 7 — Apply the requested density.
STEP 8 — Verify every quote is verbatim and belongs to its stated sentence_key.
STEP 9 — Return structured output only.

━━━ OUTPUT ━━━

Return ONLY valid JSON. No Markdown. No explanation before or after.
Schema:
{
  "highlights": [
    { "sentence_key": "p3-S7", "quote": "exact text copied from source", "category": "definition", "confidence": 0.94 }
  ]
}
If nothing should be highlighted: { "highlights": [] }

Never return a quote that does not appear verbatim inside its referenced sentence.
Never generate geometry.
Never fabricate sentence keys.

${scope}

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
      const raw = JSON.parse(cleaned)
      // New schema wraps selections in { "highlights": [...] }; accept both
      // the wrapped object and a bare array for robustness.
      parsed = Array.isArray(raw) ? raw : (Array.isArray(raw?.highlights) ? raw.highlights : null)
      if (!parsed) throw new Error('Expected { highlights: [...] } array')
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
    // Pure ceiling — densities control how much to ACCEPT, never how much to
    // produce. Zero highlights is a valid outcome; there is no minimum.
    const budget = DENSITY_BUDGET[density] ?? DENSITY_BUDGET.normal
    const totalChars = inventory.reduce((sum, s) => sum + s.text.length, 0)
    const maxChars = Math.max((budget.maxPct / 100) * totalChars, 500)
    const final: Candidate[] = []
    let usedChars = 0
    for (const cand of kept) {
      const qLen = cand.quote.length
      if (final.length > 0 && usedChars + qLen > maxChars) continue
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
