import type { ProcessingJob, JobStatus } from '../../types/processing';

export type EventMap = {
  DocumentUploaded: { documentId: string; workspaceId: string; file: File };
  JobStatusChanged: { jobId: string; status: JobStatus; job: ProcessingJob };
  InspectionCompleted: { jobId: string; metadata: any };
  ExtractionCompleted: { jobId: string; data: any };
  OCRCompleted: { jobId: string; data: any };
  LayoutCompleted: { jobId: string; data: any };
  JobFailed: { jobId: string; error: string };
  JobCancelled: { jobId: string };
};

type EventKey = keyof EventMap;
type EventReceiver<T extends EventKey> = (params: EventMap[T]) => void;

class EventBusImpl {
  private listeners: { [K in EventKey]?: Array<EventReceiver<K>> } = {};

  on<T extends EventKey>(event: T, receiver: EventReceiver<T>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(receiver);
  }

  off<T extends EventKey>(event: T, receiver: EventReceiver<T>): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event]!.filter(
      (listener) => listener !== receiver
    ) as any;
  }

  emit<T extends EventKey>(event: T, data: EventMap[T]): void {
    const receivers = this.listeners[event];
    if (receivers) {
      receivers.forEach((receiver) => {
        try {
          receiver(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

export const EventBus = new EventBusImpl();
