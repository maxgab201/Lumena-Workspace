import { JobQueue } from './JobQueue';
import { EventBus } from './EventBus';
import { InspectionStage } from './stages/InspectionStage';
import { usePageRegistryStore } from '../../stores/pageRegistryStore';
import { ProviderFallback } from '../providers/ProviderFallback';
import { providerConfig } from '../providers/provider.config';
import type { OCRProvider, OCRData } from '../providers/interfaces';
import type { DocumentProfile, ProviderResult } from '../providers/types';

class ProcessingEngineImpl {
  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    EventBus.on('DocumentUploaded', async ({ documentId, workspaceId, file }) => {
      // 1. Enqueue job
      const job = await JobQueue.enqueue(workspaceId, documentId);
      
      // 2. Start Processing Pipeline
      this.processJob(job.id, file);
    });
  }

  private async processJob(jobId: string, file: File) {
    try {
      // Stage 1: Inspection
      await JobQueue.updateStatus(jobId, 'inspecting', 5);
      const metadata = await InspectionStage.inspectPdf(file);
      
      EventBus.emit('InspectionCompleted', { jobId, metadata });
      
      // Integrate with Page Registry (Create initial pages)
      const { initializeRegistry } = usePageRegistryStore.getState();
      initializeRegistry(metadata.pageCount);
      
      // Update Job status
      await JobQueue.updateStatus(jobId, 'extracting', 20);

      const profile: DocumentProfile = {
        isDigital: !metadata.isScanned,
        hasImages: true,
        hasTables: true,
        hasMath: false,
        hasHandwriting: false,
        hasMultiColumn: true,
        pageCount: metadata.pageCount,
        primaryLanguage: 'en', // Assume English for now, can be detected later
      };

      // 1. Extraction Stage
      // const textExtractor = ProviderRouter.getBestProvider<TextExtractor>('extraction', profile);
      // if (textExtractor) {
      //   await textExtractor.extractText(file, profile);
      // }

      // 2. OCR Stage (using Fallback)
      await JobQueue.updateStatus(jobId, 'ocr', 50);
      
      try {
        const ocrResult = await ProviderFallback.executeWithFallback<OCRProvider, ProviderResult<OCRData>>(
          providerConfig.fallbacks.ocr,
          async (provider) => await provider.processPage(file, profile)
        );
        console.log(`[ProcessingEngine] OCR completed via ${ocrResult.providerId} in ${ocrResult.executionTime}ms`);
      } catch (ocrError: any) {
        console.warn(`[ProcessingEngine] OCR stage failed/skipped:`, ocrError.message);
        // We continue pipeline execution even if OCR fails for now (e.g. PDF without image conversion pipeline)
      }

      // 3. Layout Stage
      // await JobQueue.updateStatus(jobId, 'layout', 80);
      // await ProviderFallback.executeWithFallback<LayoutProvider, ProviderResult<LayoutData>>(
      //   providerConfig.fallbacks.layout,
      //   async (provider) => await provider.analyzeLayout(file, profile)
      // );

      // For Block 5.2, we just fast-forward to Completed
      await JobQueue.updateStatus(jobId, 'completed', 100);
      
    } catch (error: any) {
      console.error(`Job ${jobId} failed:`, error);
      await JobQueue.updateStatus(jobId, 'failed', 0, error.message || 'Unknown error');
      EventBus.emit('JobFailed', { jobId, error: error.message });
    }
  }
}

export const ProcessingEngine = new ProcessingEngineImpl();
