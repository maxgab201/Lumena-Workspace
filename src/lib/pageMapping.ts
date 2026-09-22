export type PageLabelSource = 'default' | 'pdf' | 'manual';

export interface PageReferenceRange {
  startLabel: string;
  endLabel?: string;
}

export interface ResolvedPageRange {
  startPage: number;
  endPage: number;
  pages: number[];
}

const PAGE_RANGE_RE = /(?:p(?:á|a)g(?:ina|inas)?|pages?|pp?\.?)[\s:]*([ivxlcdm]+|\d+)(?:\s*(?:-|–|—|a|to|hasta|y|and)\s*([ivxlcdm]+|\d+))?/i;

export function normalizePageLabel(value: string): string {
  return value.trim().replace(/^p(?:á|a)g(?:ina)?\s*/i, '').toLowerCase();
}

export function defaultPageLabels(totalPages: number): string[] {
  return Array.from({ length: totalPages }, (_, index) => String(index + 1));
}

export function normalizePdfLabels(totalPages: number, labels?: string[] | null): string[] {
  if (!labels || labels.length !== totalPages) return defaultPageLabels(totalPages);
  return labels.map((label, index) => String(label || index + 1).trim());
}

export function applyPageLabelOverrides(
  baseLabels: string[],
  overrides: Record<number, string>,
): string[] {
  const next = [...baseLabels];
  for (const [physicalPageRaw, label] of Object.entries(overrides)) {
    const physicalPage = Number(physicalPageRaw);
    if (!Number.isInteger(physicalPage) || physicalPage < 1 || physicalPage > next.length) continue;
    const clean = String(label ?? '').trim();
    if (clean) next[physicalPage - 1] = clean;
  }
  return next;
}

export function resolvePageReference(labels: string[], input: string): number | null {
  const normalized = normalizePageLabel(input);
  if (!normalized) return null;

  const exact = labels.findIndex((label) => normalizePageLabel(label) === normalized);
  if (exact >= 0) return exact + 1;

  if (/^\d+$/.test(normalized)) {
    const physical = Number(normalized);
    if (physical >= 1 && physical <= labels.length) return physical;
  }

  return null;
}

export function extractPageReferenceRange(text: string): PageReferenceRange | null {
  const match = text.match(PAGE_RANGE_RE);
  if (!match?.[1]) return null;
  return {
    startLabel: match[1],
    endLabel: match[2] || undefined,
  };
}

export function resolvePageRange(
  labels: string[],
  range: PageReferenceRange,
  maxPages = 80,
): ResolvedPageRange | null {
  const startPage = resolvePageReference(labels, range.startLabel);
  const endPage = resolvePageReference(labels, range.endLabel ?? range.startLabel);
  if (!startPage || !endPage) return null;

  const from = Math.min(startPage, endPage);
  const to = Math.max(startPage, endPage);
  if (to - from + 1 > maxPages) return null;

  return {
    startPage: from,
    endPage: to,
    pages: Array.from({ length: to - from + 1 }, (_, index) => from + index),
  };
}

export function pageLabelFor(labels: string[], physicalPage: number): string {
  return labels[physicalPage - 1] ?? String(physicalPage);
}

export function hasLogicalPageLabels(labels: string[]): boolean {
  return labels.some((label, index) => normalizePageLabel(label) !== String(index + 1));
}

function romanToNumber(value: string): number | null {
  const roman = value.trim().toUpperCase();
  if (!/^[IVXLCDM]+$/.test(roman)) return null;
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < roman.length; i += 1) {
    const current = map[roman[i]];
    const next = map[roman[i + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return total > 0 ? total : null;
}

function numberToRoman(value: number): string {
  const pairs: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let remaining = Math.max(1, Math.floor(value));
  let result = '';
  for (const [amount, glyph] of pairs) {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  }
  return result;
}

export function buildSequentialOverrides(
  currentPhysicalPage: number,
  label: string,
  totalPages: number,
): Record<number, string> {
  const clean = label.trim();
  const overrides: Record<number, string> = {};
  if (!clean || currentPhysicalPage < 1 || currentPhysicalPage > totalPages) return overrides;

  if (/^\d+$/.test(clean)) {
    const start = Number(clean);
    for (let page = currentPhysicalPage; page <= totalPages; page += 1) {
      overrides[page] = String(start + page - currentPhysicalPage);
    }
    return overrides;
  }

  const romanStart = romanToNumber(clean);
  if (romanStart) {
    const lower = clean === clean.toLowerCase();
    for (let page = currentPhysicalPage; page <= totalPages; page += 1) {
      const roman = numberToRoman(romanStart + page - currentPhysicalPage);
      overrides[page] = lower ? roman.toLowerCase() : roman;
    }
    return overrides;
  }

  overrides[currentPhysicalPage] = clean;
  return overrides;
}

const LOCAL_PREFIX = 'lumena.page-label-overrides.';

export function loadLocalPageLabelOverrides(documentId: string): Record<number, string> {
  if (typeof window === 'undefined' || !documentId) return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFIX + documentId);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<number, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const page = Number(key);
      if (Number.isInteger(page) && page > 0 && typeof value === 'string' && value.trim()) {
        result[page] = value.trim();
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function saveLocalPageLabelOverrides(documentId: string, overrides: Record<number, string>): void {
  if (typeof window === 'undefined' || !documentId) return;
  window.localStorage.setItem(LOCAL_PREFIX + documentId, JSON.stringify(overrides));
}

export function clearLocalPageLabelOverrides(documentId: string): void {
  if (typeof window === 'undefined' || !documentId) return;
  window.localStorage.removeItem(LOCAL_PREFIX + documentId);
}
