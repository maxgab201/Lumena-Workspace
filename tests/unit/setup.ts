import { vi } from 'vitest';

// Point PDF.js at its worker bundle for the Node test environment.
// (The bundler handles this via `?url` imports in app code; vitest does not.)
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
try {
  const require = createRequire(import.meta.url);
  const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
  (globalThis as Record<string, unknown>).__PDFJS_WORKER_URL__ = pathToFileURL(workerPath).href;
} catch {
  // Worker resolution is best-effort; tests that need it will set it explicitly.
}

// PDF.js requires DOMMatrix in jsdom (canvas API shims)
if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(_init?: unknown) {}
    static fromMatrix() { return new DOMMatrix(); }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  (globalThis as Record<string, unknown>).Path2D = class Path2D { moveTo() {} lineTo() {} closePath() {} };
}
if (typeof globalThis.ImageData === 'undefined') {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {
    width: number; height: number; data: Uint8ClampedArray;
    constructor(widthOrData: number | Uint8ClampedArray, height?: number) {
      if (typeof widthOrData === 'number') {
        this.width = widthOrData; this.height = height ?? 0;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = widthOrData; this.width = widthOrData.length / 4; this.height = height ?? 0;
      }
    }
  };
}

function createMockSupabase() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ data: null, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
    functions: { invoke: vi.fn() },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'mock-url' }, error: null }),
      })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
  };
}

// Global mock
vi.mock('../../src/lib/supabase', () => ({
  supabase: createMockSupabase(),
}));

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});