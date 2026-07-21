/**
 * AnalysisEvents - Event system for analysis pipeline
 *
 * Publishes events when tasks start, complete, or fail.
 * Frontend can subscribe for real-time UI updates.
 */

export type AnalysisEvent =
  | { type: 'TaskStarted'; documentId: string; task: string }
  | { type: 'TaskCompleted'; documentId: string; task: string }
  | { type: 'TaskFailed'; documentId: string; task: string; error: string }
  | { type: 'AnalysisUpdated'; documentId: string }
  | { type: 'DocumentReady'; documentId: string };

type EventListener = (event: AnalysisEvent) => void;

export class AnalysisEvents {
  private listeners: Map<string, EventListener[]> = new Map();

  on(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);

    return () => {
      const list = this.listeners.get(eventType);
      if (list) {
        const index = list.indexOf(listener);
        if (index > -1) list.splice(index, 1);
      }
    };
  }

  emit(event: AnalysisEvent): void {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach(listener => listener(event));
  }
}
