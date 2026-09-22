import { create } from 'zustand';
import type { ViewerFitMode } from '../types';
import { usePageRegistryStore } from './pageRegistryStore';
import {
  applyPageLabelOverrides,
  defaultPageLabels,
  normalizePdfLabels,
  pageLabelFor,
  resolvePageReference,
  type PageLabelSource,
} from '../lib/pageMapping';

interface SearchMatch {
  pageIndex: number;
  matches: Array<{
    text: string;
    rect: { x: number; y: number; width: number; height: number };
    pageNumber: number;
  }>;
}

interface ViewerStoreState {
  documentId: string | null;
  totalPages: number;
  currentPage: number;
  scale: number;
  fitMode: ViewerFitMode;
  rotation: 0 | 90 | 180 | 270;
  isLoading: boolean;
  showOverlays: boolean;
  selectedText: string;
  selectedTextPageIndex: number;
  selectionRects: Array<{ x: number; y: number; width: number; height: number }>;
  nativePageLabels: string[];
  pageLabels: string[];
  pageLabelSource: PageLabelSource;
  pageLabelOverrides: Record<number, string>;
  searchQuery: string;
  searchResults: SearchMatch[];
  currentMatchIndex: number;
  isSearchActive: boolean;

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
  setSelectedText: (text: string, pageIndex: number) => void;
  setSelectionRects: (rects: Array<{ x: number; y: number; width: number; height: number }>) => void;
  clearSelection: () => void;
  setPageLabels: (labels?: string[] | null, source?: PageLabelSource) => void;
  applyPageLabelOverrides: (overrides: Record<number, string>) => void;
  clearPageLabelOverrides: () => void;
  getPageLabel: (physicalPage: number) => string;
  resolvePageReference: (reference: string) => number | null;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchMatch[]) => void;
  setCurrentMatchIndex: (index: number) => void;
  setIsSearchActive: (active: boolean) => void;
  clearSearch: () => void;
  goToMatch: (match: SearchMatch['matches'][0]) => void;
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
  selectedText: '',
  selectedTextPageIndex: -1,
  selectionRects: [],
  nativePageLabels: [],
  pageLabels: [],
  pageLabelSource: 'default',
  pageLabelOverrides: {},
  searchQuery: '',
  searchResults: [],
  currentMatchIndex: 0,
  isSearchActive: false,

  setDocumentId: (id) => set({ documentId: id }),
  setTotalPages: (total) => set({ totalPages: total }),
  setCurrentPage: (page) => {
    const { totalPages } = get();
    if (page >= 1 && page <= totalPages) set({ currentPage: page });
  },
  setScale: (scale) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    set({ scale: clamped, fitMode: 'custom' });
  },
  setFitMode: (mode) => set({ fitMode: mode }),

  zoomIn: () => {
    const { scale } = get();
    set({ scale: Math.min(MAX_SCALE, scale + ZOOM_STEP), fitMode: 'custom' });
  },
  zoomOut: () => {
    const { scale } = get();
    set({ scale: Math.max(MIN_SCALE, scale - ZOOM_STEP), fitMode: 'custom' });
  },
  rotate: () => {
    const { rotation } = get();
    set({ rotation: ((rotation + 90) % 360) as 0 | 90 | 180 | 270 });
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
    usePageRegistryStore.getState().initializeRegistry(totalPages);
    const labels = defaultPageLabels(totalPages);
    set({
      totalPages,
      currentPage: 1,
      isLoading: false,
      nativePageLabels: labels,
      pageLabels: labels,
      pageLabelSource: 'default',
      pageLabelOverrides: {},
    });
  },

  setPageLabels: (labels, source = labels ? 'pdf' : 'default') => {
    const { totalPages, pageLabelOverrides } = get();
    const nativePageLabels = normalizePdfLabels(totalPages, labels);
    const effective = applyPageLabelOverrides(nativePageLabels, pageLabelOverrides);
    set({
      nativePageLabels,
      pageLabels: effective,
      pageLabelSource: Object.keys(pageLabelOverrides).length > 0 ? 'manual' : source,
    });

    for (let index = 0; index < effective.length; index += 1) {
      usePageRegistryStore.getState().updatePage(index, { printedPageNumber: effective[index] });
    }
  },

  applyPageLabelOverrides: (overrides) => {
    const { nativePageLabels, totalPages } = get();
    const base = nativePageLabels.length === totalPages ? nativePageLabels : defaultPageLabels(totalPages);
    const effective = applyPageLabelOverrides(base, overrides);
    set({
      pageLabelOverrides: overrides,
      pageLabels: effective,
      pageLabelSource: Object.keys(overrides).length > 0 ? 'manual' : 'pdf',
    });
    for (let index = 0; index < effective.length; index += 1) {
      usePageRegistryStore.getState().updatePage(index, { printedPageNumber: effective[index] });
    }
  },

  clearPageLabelOverrides: () => {
    const { nativePageLabels, totalPages } = get();
    const base = nativePageLabels.length === totalPages ? nativePageLabels : defaultPageLabels(totalPages);
    set({
      pageLabelOverrides: {},
      pageLabels: base,
      pageLabelSource: 'pdf',
    });
    for (let index = 0; index < base.length; index += 1) {
      usePageRegistryStore.getState().updatePage(index, { printedPageNumber: base[index] });
    }
  },

  getPageLabel: (physicalPage) => pageLabelFor(get().pageLabels, physicalPage),
  resolvePageReference: (reference) => resolvePageReference(get().pageLabels, reference),

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
      selectedText: '',
      selectedTextPageIndex: -1,
      selectionRects: [],
      nativePageLabels: [],
      pageLabels: [],
      pageLabelSource: 'default',
      pageLabelOverrides: {},
      searchQuery: '',
      searchResults: [],
      currentMatchIndex: 0,
      isSearchActive: false,
    });
  },

  setSelectedText: (text, pageIndex) => set({ selectedText: text, selectedTextPageIndex: pageIndex }),
  setSelectionRects: (rects) => set({ selectionRects: rects }),
  clearSelection: () => set({ selectedText: '', selectedTextPageIndex: -1, selectionRects: [] }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setCurrentMatchIndex: (index) => set({ currentMatchIndex: index }),
  setIsSearchActive: (active) => set({ isSearchActive: active }),
  clearSearch: () => set({ searchQuery: '', searchResults: [], currentMatchIndex: 0, isSearchActive: false }),
  goToMatch: (match) => get().setCurrentPage(match.pageNumber),
}));
