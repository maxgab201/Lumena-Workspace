import { describe, expect, it } from 'vitest';
import { buildStudyQaRequest } from '../../src/lib/studyQa';
import { buildPromptWithRAG } from '../../supabase/functions/_shared/chatPrompt';

describe('study-mode "Ask" request', () => {
  const request = buildStudyQaRequest({
    question: 'What is mitosis?',
    material: 'Mitosis: cell division that produces two identical cells.',
    documentId: 'doc-1',
    workspaceId: 'ws-1',
    modelCode: 'gemini-3.5-flash-lite',
  });

  it('is addressed to the workspace and document, never to the user id', () => {
    expect(request.workspace_id).toBe('ws-1');
    expect(request.document_id).toBe('doc-1');
    expect(request.context.workspaceId).toBe('ws-1');
    expect(request.context.documentId).toBe('doc-1');
  });

  it('asks for a non-streamed chat completion with the given model', () => {
    expect(request).toMatchObject({
      prompt: 'What is mitosis?',
      action_type: 'chat',
      model_code: 'gemini-3.5-flash-lite',
      stream: false,
    });
  });

  it('delivers the study material in a field the gateway actually reads', () => {
    // A free-form `systemPrompt` in the context is ignored by the gateway, which left the
    // model answering without any of the document material.
    const prompt = buildPromptWithRAG(request.prompt, request.context);

    expect(prompt).toContain('Mitosis: cell division that produces two identical cells.');
    expect(prompt).toContain('<document_content>');
    expect(prompt.endsWith('=== USER QUESTION ===\nWhat is mitosis?')).toBe(true);
  });
});
