export interface StudyQaRequestInput {
  question: string;
  /** Text the answer must be grounded in: page text, glossary, flashcards, timeline. */
  material: string;
  documentId: string;
  workspaceId: string;
  modelCode: string;
}

/**
 * Body for the study-mode "Ask" tab.
 *
 * The gateway only reads the documented context fields. This request used to send a
 * free-form `systemPrompt` (ignored) and the user's id as the workspace, so it could never
 * succeed. The material travels as `documentText`, which the gateway fences off as DATA.
 */
export function buildStudyQaRequest(input: StudyQaRequestInput) {
  return {
    prompt: input.question,
    workspace_id: input.workspaceId,
    action_type: 'chat' as const,
    model_code: input.modelCode,
    document_id: input.documentId,
    context: {
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      documentText: input.material,
    },
    stream: false,
  };
}
