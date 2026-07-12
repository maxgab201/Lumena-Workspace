import { create } from 'zustand';
import type { ViewerFitMode } from '../types';
import { usePageRegistryStore } from './pageRegistryStore';

interface ViewerStoreState {
  documentId: string | null;
  totalPages: number;
  currentPage: number;
  scale: number;
  fitMode: ViewerFitMode;
  rotation: 0 | 90 | 180 | 270;
  isLoading: boolean;
  showOverlays: boolean;

  // Actions
  setDocumentId: (id: string | null) => void;
  setTotalPages: (total: number) => void;
  setCurrentPage: (page: number) => void;
  setScale: (scale: number) => void;
  setFitMode: (mode: ViewerFitMode) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  toggleOverlays: () => void;
  initializeDocument: (totalPages: number) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const ZOOM_STEP = 0.25;
const MIN_SCALE = 0.25;
const MAX_SCALE = 5.0;

export const useViewerStore = create<ViewerStoreState>((set, get) => ({
  documentId: null,
  totalPages: 0,
  currentPage: 1,
  scale: 1.0,
  fitMode: 'fit-page',
  rotation: 0,
  isLoading: true,
  showOverlays: true,

  setDocumentId: (id) => set({ documentId: id }),
  setTotalPages: (total) => set({ totalPages: total }),
  setCurrentPage: (page) => {
    const { totalPages } = get();
    if (page >= 1 && page <= totalPages) {
      set({ currentPage: page });
    }
  },
  setScale: (scale) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    set({ scale: clamped, fitMode: 'custom' });
  },
  setFitMode: (mode) => set({ fitMode: mode }),

  zoomIn: () => {
    const { scale } = get();
    const next = Math.min(MAX_SCALE, scale + ZOOM_STEP);
    set({ scale: next, fitMode: 'custom' });
  },
  zoomOut: () => {
    const { scale } = get();
    const next = Math.max(MIN_SCALE, scale - ZOOM_STEP);
    set({ scale: next, fitMode: 'custom' });
  },
  rotate: () => {
    const { rotation } = get();
    const next = ((rotation + 90) % 360) as 0 | 90 | 180 | 270;
    set({ rotation: next });
  },
  goToNextPage: () => {
    const { currentPage, totalPages } = get();
    if (currentPage < totalPages) set({ currentPage: currentPage + 1 });
  },
  goToPrevPage: () => {
    const { currentPage } = get();
    if (currentPage > 1) set({ currentPage: currentPage - 1 });
  },
  goToFirstPage: () => set({ currentPage: 1 }),
  goToLastPage: () => set((state) => ({ currentPage: state.totalPages })),
  toggleOverlays: () => set((state) => ({ showOverlays: !state.showOverlays })),

  initializeDocument: (totalPages) => {
    // Initialize the centralized page registry
    usePageRegistryStore.getState().initializeRegistry(totalPages);
    set({ totalPages, currentPage: 1, isLoading: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => {
    usePageRegistryStore.getState().reset();
    set({
      documentId: null,
      totalPages: 0,
      currentPage: 1,
      scale: 1.0,
      fitMode: 'fit-width',
      rotation: 0,
      isLoading: true,
    });
  }
}));
