export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'member' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  name: string;
  file_path: string;
  size_bytes: number;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export interface Highlight {
  id: string;
  document_id: string;
  page_number: number;
  content: string;
  note?: string;
  coordinates: any; // Simplified for now
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled';
  current_period_end: string;
}

export interface Credits {
  user_id: string;
  available: number;
  used: number;
  limit: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  created_at: string;
}

// ─── PDF Viewer Types ───────────────────────────────────────────────

import type { ProviderResult } from '../lib/providers/types';
import type { LayoutData } from '../lib/providers/interfaces/LayoutProvider';
import type { OCRData } from '../lib/providers/interfaces/OCRProvider';
import type { VisionData } from '../lib/providers/interfaces/VisionProvider';

/** Centralized Page Registry Data for a single PDF page */
export interface PageData {
  /** Zero-based PDF page index */
  pdfPageIndex: number;
  /** Visual/printed page number detected via OCR (null until OCR runs) */
  printedPageNumber: string | null;
  /** Render status (is the canvas currently rendered in the DOM) */
  renderStatus: 'idle' | 'loading' | 'rendered' | 'error';
  /** Layout processing status for this page */
  layoutStatus: 'idle' | 'pending' | 'processing' | 'completed' | 'error';
  layoutData?: ProviderResult<LayoutData>;
  /** OCR processing status for this page */
  ocrStatus: 'idle' | 'pending' | 'processing' | 'completed' | 'error';
  ocrData?: ProviderResult<OCRData>;
  /** AI analysis status for this page */
  aiStatus: 'idle' | 'pending' | 'processing' | 'completed' | 'error';
  visionData?: ProviderResult<VisionData>;
  /** Highlight status for this page */
  highlightStatus: 'idle' | 'loading' | 'ready';
  /** Annotation status for this page */
  annotationStatus: 'idle' | 'loading' | 'ready';
  /** Page rotation override (if different from global) */
  rotation: number;
  /** Page scale override (if different from global) */
  scale: number;
  /** Cached measurements for virtualization */
  measuredHeight: number | null;
  measuredWidth: number | null;
  /** Viewport dimensions / scale */
  viewport: { width: number; height: number; scale: number; rotation: number } | null;
  /** Caching state in memory */
  cacheState: 'uncached' | 'cached' | 'evicted';
}

/** PDF viewer zoom/fit modes */
export type ViewerFitMode = 'fit-width' | 'fit-page' | 'custom';

/** PDF viewer state */
export interface ViewerState {
  documentId: string | null;
  totalPages: number;
  currentPage: number;
  scale: number;
  fitMode: ViewerFitMode;
  rotation: 0 | 90 | 180 | 270;
  pages: PageData[];
}

export * from './processing';

export * from './highlights';
export * from './chat';