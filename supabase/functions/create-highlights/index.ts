import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGemini(apiKey: string, model: string, prompt: string): Promise<{ ok: boolean; text: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.15, responseMimeType: "application/json" } }) }
  );
  if (!res.ok) return { ok: false, text: await res.text().catch(() => "") };
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  return { ok: true, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = await req.json();
    const { document_id, workspace_id, scope = "current_page", page = 1, instruction, model_id = "gemini-3.5-flash-lite" } = payload;
    if (!document_id || !workspace_id || !instruction || typeof instruction !== "string") {
      return new Response(JSON.stringify({ error: "Missing document_id, workspace_id or instruction" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Membership + doc access
    const { data: membership } = await supabaseClient.from("workspace_members").select("id").eq("workspace_id", workspace_id).eq("user_id", user.id).single();
    if (!membership) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: doc } = await supabaseClient.from("documents").select("id, workspace_id").eq("id", document_id).single();
    if (!doc || doc.workspace_id !== workspace_id) return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Tier check (reuse same rule as ai-gateway)
    const { data: subData } = await supabaseClient.from("subscriptions").select("plan_code").eq("workspace_id", workspace_id).single();
    const planCode = subData?.plan_code ?? "free";
    const tier = (model_id === "gemini-3.1-flash-lite" || model_id === "gemini-3.5-flash-lite" || model_id?.endsWith(":free")) ? "free" : "pro";
    if (planCode === "free" && tier === "pro") {
      return new Response(JSON.stringify({ error: "Model not allowed on free plan", plan_required: "pro" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Quota (free only; action = ai_highlight)
    if (planCode === "free") {
      const { data: qRes } = await supabaseClient.rpc("consume_ai_request", { p_workspace_id: workspace_id, p_action: "ai_highlight", p_limit: 50 });
      if (!qRes || !qRes.allowed) {
        return new Response(JSON.stringify({ error: "Daily AI request limit reached (50/day).", quota: { used: (qRes?.chat_count || 0) + (qRes?.highlight_count || 0), limit: 50, resets_at: qRes?.resets_at || new Date().toISOString() } }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Obtain page inventory (text) for validation
    const pageIndex = (scope === "current_page" && page) ? page - 1 : 0;
    const { data: textRow } = await supabaseClient.from("document_page_texts").select("page_text").eq("document_id", document_id).eq("page_number", pageIndex + 1).maybeSingle();
    const inventoryText = textRow?.page_text || "";

    // Call LLM for semantic selection (Gemini or OpenRouter :free)
    const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    const prompt = `Document text (page ${page}):\n${inventoryText.substring(0, 12000)}\n\nInstruction: find exact sentence(s) related to: "${instruction}". Output ONLY JSON: {selections:[{quote:string,confidence:number}]}. If nothing matches, return {selections:[]}.`;
    let llmResult = "";
    if (model_id?.endsWith(":free") || model_id?.includes("nex-")) {
      // Use OpenRouter for free models (simplified — direct completion for highlight)
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY") ?? ""}` },
        body: JSON.stringify({ model: model_id, messages: [{ role: "user", content: prompt }] }),
      });
      const orJson = orRes.ok ? await orRes.json() : { choices: [{ message: { content: "" } }] };
      llmResult = orJson.choices?.[0]?.message?.content ?? "";
    } else if (apiKey) {
      const gem = await callGemini(apiKey, model_id || "gemini-3.5-flash-lite", prompt);
      llmResult = gem.ok ? gem.text : "";
    } else {
      return new Response(JSON.stringify({ error: "AI model not configured." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Parse JSON from LLM result (strip markdown if any)
    let parsed: any = null;
    try {
      const clean = llmResult.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // If LLM didn't return structured JSON, fall back to empty
      parsed = { selections: [] };
    }

    const selections = Array.isArray(parsed?.selections) ? parsed.selections : [];
    const createdIds: string[] = [];
    const failedPages: Array<{ page: number; error: string }> = [];

    for (const sel of selections) {
      const quote = String(sel?.quote || "").trim();
      if (!quote) continue;
      // Validate quote exists in inventory text (exact or near-exact):
      // For simplicity, allow if inventory contains the quote or a normalized version.
      const normalizedInventory = inventoryText.toLowerCase().replace(/[^\w\s]/g, "");
      const normalizedQuote = quote.toLowerCase().replace(/[^\w\s]/g, "");
      if (!normalizedInventory.includes(normalizedQuote.substring(0, Math.min(30, normalizedQuote.length))) && !normalizedInventory.includes(normalizedQuote)) {
        // Skip quotes that can't be validated against real document text
        continue;
      }
      // Create highlight (geometry approximated from inventory; real geometry resolved by viewer overlay)
      const { data: hData } = await supabaseClient.from("highlights").insert({
        document_id,
        workspace_id,
        page_index: pageIndex,
        text: quote.substring(0, 500),
        rects: JSON.stringify([]), // viewer resolves from text layer
        color: "#fef08a",
        source: "ai",
        ai_metadata: JSON.stringify({ instruction, model: model_id || "gemini-3.5-flash-lite", confidence: sel?.confidence ?? 0.7 }),
      }).select("id").single();
      if (hData?.id) createdIds.push(hData.id);
    }

    // Note: overlay updates on viewer without reload via highlightStore / viewer events.
    // The viewer's highlight overlay picks up new rows automatically from DB or via store refresh.

    return new Response(JSON.stringify({
      created: createdIds.length,
      highlights: createdIds.map((id) => ({ id, page_index: pageIndex + 1, text: "" })),
      model: model_id || "gemini-3.5-flash-lite",
      request_id: crypto.randomUUID?.() || "unknown",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (err: any) {
    console.error("[create-highlights] error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error", request_id: crypto.randomUUID?.() || "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
});

async function callGemini(apiKey: string, model: string, prompt: string): Promise<{ ok: boolean; text: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.15, responseMimeType: "application/json" } }) }
  );
  if (!res.ok) return { ok: false, text: await res.text().catch(() => "") };
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  return { ok: true, text };
}
