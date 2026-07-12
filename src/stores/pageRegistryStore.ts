import { create } from 'zustand';
import type { PageData } from '../types';

interface PageRegistryState {
  pages: Record<number, PageData>;
  /** Initialize the registry with empty data for all pages */
  initializeRegistry: (totalPages: number) => void;
  /** Update specific fields of a single page */
  updatePage: (pageIndex: number, data: Partial<PageData>) => void;
  /** Get a single page's data */
  getPage: (pageIndex: number) => PageData | undefined;
  /** Reset the entire registry */
  reset: () => void;
}

/**
 * Centralized Page Registry
 * 
 * This store acts as a single source of truth for all page-level state.
 * By keeping it separate from the global viewer store (which handles zoom, rotation, pagination),
 * we prevent global re-renders when a single page updates its OCR/AI/render status.
 * 
 * Future layers (OCR, Highlights, AI, Annotations) should read and write to this
 * registry to maintain decoupled, high-performance state.
 */
export const usePageRegistryStore = create<PageRegistryState>((set, get) => ({
  pages: {},

  initializeRegistry: (totalPages: number) => {
    const newPages: Record<number, PageData> = {};
    for (let i = 0; i < totalPages; i++) {
      newPages[i] = {
        pdfPageIndex: i,
        printedPageNumber: null,
        renderStatus: 'idle',
        layoutStatus: 'idle',
        ocrStatus: 'idle',
        aiStatus: 'idle',
        highlightStatus: 'idle',
        annotationStatus: 'idle',
        rotation: 0,
        scale: 1.0,
        measuredHeight: null,
        measuredWidth: null,
        viewport: null,
        cacheState: 'uncached',
      };
    }
    set({ pages: newPages });
  },

  updatePage: (pageIndex, data) => {
    set((state) => {
      const existing = state.pages[pageIndex];
      if (!existing) return state; // Prevent updating uninitialized pages
      
      return {
        pages: {
          ...state.pages,
          [pageIndex]: {
            ...existing,
            ...data,
          }
        }
      };
    });
  },

  getPage: (pageIndex) => {
    return get().pages[pageIndex];
  },

  reset: () => set({ pages: {} })
}));
