import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  DEFAULT_HIGHLIGHT_FREE_MODEL,
  getCatalog,
  resolvePlan,
} from "../_shared/modelCatalog.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Scope = 'current_page' | 'document';

serve(async (req) => {
  const request_id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing Authorization', request_id }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
    if (authError || !user) return json({ error: 'Unauthorized', request_id }, 401);

    const payload = await req.json().catch(() => ({}));
    const documentId = String(payload?.document_id ?? '');
    const workspaceId = String(payload?.workspace_id ?? '');
    const instruction = String(payload?.instruction ?? '').trim();
    const scope = payload?.scope as Scope;
    const page = Number(payload?.page ?? 0);
    const modelId = String(payload?.model_id ?? DEFAULT_HIGHLIGHT_FREE_MODEL);

    if (!documentId || !workspaceId || !instruction) {
      return json({ error: 'Missing document_id, workspace_id or instruction', request_id }, 400);
    }
    if (instruction.length > 1200) {
      return json({ error: 'Highlight instruction is too long', request_id }, 400);
    }
    if (scope !== 'current_page' && scope !== 'document') {
      return json({ error: 'scope must be current_page or document', request_id }, 400);
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'Forbidden', request_id }, 403);

    const { data: doc } = await supabase
      .from('documents')
      .select('id, workspace_id, page_count')
      .eq('id', documentId)
      .maybeSingle();
    if (!doc || doc.workspace_id !== workspaceId) {
      return json({ error: 'Document not found', request_id }, 404);
    }

    if (scope === 'current_page') {
      if (!Number.isInteger(page) || page < 1) {
        return json({ error: 'A valid page is required for current_page scope', request_id }, 400);
      }
      if (doc.page_count && page > doc.page_count) {
        return json({ error: 'Page is outside the document', request_id }, 400);
      }
    }

    const [catalog, plan] = await Promise.all([
      getCatalog(),
      resolvePlan(supabase, workspaceId),
    ]);
    const model = catalog.find((candidate) => candidate.model_id === modelId);
    if (!model || model.available === false) {
      return json({ error: 'Unknown or unavailable AI model', request_id }, 400);
    }
    if (!model.capabilities.includes('ai_highlight')) {
      return json({ error: 'Selected model does not support AI Highlight', request_id }, 400);
    }
    if (plan === 'free' && model.tier === 'pro') {
      return json({
        error: 'Model not allowed on free plan',
        plan_required: 'pro',
        current_plan: 'free',
        request_id,
      }, 403);
    }

    // This endpoint authorizes a USER-INITIATED action only. It deliberately
    // does not read document content and never invents coordinates. The client
    // passes the authorized action into AiHighlightService, which sends the
    // real sentence inventory to the authenticated ai-highlight backend and
    // maps verified quotes back to real PDF/OCR word geometry.
    return json({
      action: {
        type: 'create_highlights',
        instruction,
        scope,
        page: scope === 'current_page' ? page : undefined,
        model_id: model.model_id,
      },
      request_id,
    }, 200);
  } catch (error) {
    console.error('[create-highlights] error', error);
    return json({
      error: error instanceof Error ? error.message : 'Internal error',
      request_id,
    }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
