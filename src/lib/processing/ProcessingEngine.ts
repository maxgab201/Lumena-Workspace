import { JobQueue } from './JobQueue';
import { EventBus } from './EventBus';
import { InspectionStage } from './stages/InspectionStage';
import { usePageRegistryStore } from '../../stores/pageRegistryStore';
import { ProviderFallback } from '../providers/ProviderFallback';
import { providerConfig } from '../providers/provider.config';
import type { OCRProvider, OCRData } from '../providers/interfaces';
import type { LayoutProvider, LayoutData } from '../providers/interfaces/LayoutProvider';
import type { VisionProvider, VisionData } from '../providers/interfaces/VisionProvider';
import type { DocumentProfile, ProviderResult } from '../providers/types';

import { ExtractionStage } from './stages/ExtractionStage';

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
      const { initializeRegistry, updatePage } = usePageRegistryStore.getState();
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

      // 2. Extraction & OCR Stage (Streaming)
      let pagesProcessed = 0;
      
      try {
        const pageStream = ExtractionStage.streamPages(file, 2.0);
        
        for await (const extractedPage of pageStream) {
          // A. Layout Stage for this page
          updatePage(extractedPage.pageIndex, { layoutStatus: 'processing' });
          try {
            const layoutResult = await ProviderFallback.executeWithFallback<LayoutProvider, ProviderResult<LayoutData>>(
              providerConfig.fallbacks.layout,
              async (provider) => await provider.analyzeLayout(extractedPage.imageBlob, profile)
            );
            console.log(`[ProcessingEngine] Page ${extractedPage.pageIndex} Layout completed via ${layoutResult.providerId} in ${layoutResult.executionTime}ms`);
            
            EventBus.emit('PageLayoutCompleted' as any, { 
              jobId, 
              pageIndex: extractedPage.pageIndex, 
              result: layoutResult 
            });
            updatePage(extractedPage.pageIndex, { layoutStatus: 'completed', layoutData: layoutResult });
          } catch (layoutError: any) {
            console.warn(`[ProcessingEngine] Page ${extractedPage.pageIndex} Layout failed:`, layoutError.message);
            updatePage(extractedPage.pageIndex, { layoutStatus: 'error' });
          }

          // B. OCR Stage for this page
          updatePage(extractedPage.pageIndex, { ocrStatus: 'processing' });
          
          try {
            // Process OCR on this specific page image
            const ocrResult = await ProviderFallback.executeWithFallback<OCRProvider, ProviderResult<OCRData>>(
              providerConfig.fallbacks.ocr,
              async (provider) => await provider.processPage(extractedPage.imageBlob, profile)
            );
            
            console.log(`[ProcessingEngine] Page ${extractedPage.pageIndex} OCR completed via ${ocrResult.providerId} in ${ocrResult.executionTime}ms`);
            
            // In the future: Dispatch EventBus event with the OCR result so the UI can layer it immediately
            EventBus.emit('PageOcrCompleted' as any, { 
              jobId, 
              pageIndex: extractedPage.pageIndex, 
              result: ocrResult 
            });
            
            updatePage(extractedPage.pageIndex, { ocrStatus: 'completed', ocrData: ocrResult });
            
          } catch (ocrError: any) {
            console.warn(`[ProcessingEngine] Page ${extractedPage.pageIndex} OCR failed/skipped:`, ocrError.message);
            updatePage(extractedPage.pageIndex, { ocrStatus: 'error' });
          }
          
          // C. Vision Stage for this page
          updatePage(extractedPage.pageIndex, { aiStatus: 'processing' });
          
          try {
            const visionPrompt = "Analyze this document page and summarize its core semantic components.";
            const visionResult = await ProviderFallback.executeWithFallback<VisionProvider, ProviderResult<VisionData>>(
              providerConfig.fallbacks.vision,
              async (provider) => await provider.analyzeImage(extractedPage.imageBlob, visionPrompt, profile)
            );
            
            console.log(`[ProcessingEngine] Page ${extractedPage.pageIndex} Vision completed via ${visionResult.providerId} in ${visionResult.executionTime}ms`);
            
            EventBus.emit('PageVisionCompleted' as any, { 
              jobId, 
              pageIndex: extractedPage.pageIndex, 
              result: visionResult 
            });
            
            updatePage(extractedPage.pageIndex, { aiStatus: 'completed', visionData: visionResult });
          } catch (visionError: any) {
            console.warn(`[ProcessingEngine] Page ${extractedPage.pageIndex} Vision failed/skipped:`, visionError.message);
            updatePage(extractedPage.pageIndex, { aiStatus: 'error' });
          }
          
          pagesProcessed++;
          
          // Calculate progressive progress (e.g. 20% to 80% range)
          const baseProgress = 20;
          const rangeProgress = 60;
          const currentProgress = baseProgress + Math.floor((pagesProcessed / metadata.pageCount) * rangeProgress);
          
          await JobQueue.updateStatus(jobId, 'ocr', currentProgress);
        }
      } catch (extractionError: any) {
        console.error(`[ProcessingEngine] Extraction Stage failed:`, extractionError.message);
        throw extractionError;
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
