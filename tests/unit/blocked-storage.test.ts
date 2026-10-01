import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSequentialOverrides, clearLocalPageLabelOverrides, loadLocalPageLabelOverrides, saveLocalPageLabelOverrides } from '../../src/lib/pageMapping';
import { readStorage, removeStorage, writeStorage } from '../../src/lib/safeStorage';

/**
 * Break test against production: with browser storage blocked (Safari "block all cookies", Firefox
 * strict mode, a sandboxed iframe) `window.localStorage` THROWS a SecurityError on access. The
 * production app rendered a completely blank page ("The operation is insecure.") because the i18n
 * module read localStorage while it was being imported; the page-label editor also stayed stuck on
 * "Guardando…" because it wrote to localStorage before its own try/catch.
 */

const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

function blockStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
}

function fullStorage() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
    },
  });
}

afterEach(() => {
  if (original) Object.defineProperty(window, 'localStorage', original);
  vi.resetModules();
});

describe('safeStorage', () => {
  it('behaves like localStorage when it is available', () => {
    expect(writeStorage('k', 'v')).toBe(true);
    expect(readStorage('k')).toBe('v');
    removeStorage('k');
    expect(readStorage('k')).toBeNull();
  });

  it('never throws when the browser blocks storage', () => {
    blockStorage();
    expect(readStorage('k')).toBeNull();
    expect(writeStorage('k', 'v')).toBe(false);
    expect(() => removeStorage('k')).not.toThrow();
  });

  it('never throws when the quota is full', () => {
    fullStorage();
    expect(writeStorage('k', 'v')).toBe(false);
    expect(readStorage('k')).toBeNull();
  });
});

describe('the app with storage blocked', () => {
  it('loads the i18n module (it used to throw at import time and blank the whole app)', async () => {
    blockStorage();
    vi.resetModules();

    const i18n = await import('../../src/i18n');

    expect(['en', 'es']).toContain(i18n.getLanguage());
    expect(() => i18n.setLanguage('es')).not.toThrow();
    expect(i18n.getLanguage()).toBe('es');
  });

  it('keeps page-label overrides usable: save, clear and load do not throw', () => {
    blockStorage();

    expect(() => saveLocalPageLabelOverrides('doc-1', { 3: 'iv' })).not.toThrow();
    expect(() => clearLocalPageLabelOverrides('doc-1')).not.toThrow();
    expect(loadLocalPageLabelOverrides('doc-1')).toEqual({});
  });

  it('still stores and reads the page-label fallback when storage works', () => {
    saveLocalPageLabelOverrides('doc-2', { 3: 'iv', 4: 'v' });
    expect(loadLocalPageLabelOverrides('doc-2')).toEqual({ 3: 'iv', 4: 'v' });
    clearLocalPageLabelOverrides('doc-2');
    expect(loadLocalPageLabelOverrides('doc-2')).toEqual({});
  });
});

describe('no source file reads browser storage without a guard', () => {
  const src = resolve(__dirname, '../../src');
  const allowed = new Set(['lib/safeStorage.ts', 'lib/modelCache.ts']); // both wrap every access in try/catch

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sources(full);
      return /\.(ts|tsx)$/.test(entry) ? [full] : [];
    });
  }

  it('goes through safeStorage everywhere else', () => {
    const offenders = sources(src)
      .filter((file) => !allowed.has(relative(src, file)))
      .filter((file) => /\b(?:window\.)?(?:localStorage|sessionStorage)\b/.test(readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '')))
      .map((file) => relative(src, file));

    expect(offenders).toEqual([]);
  });
});

describe('buildSequentialOverrides keeps a label that is not a canonical roman numeral', () => {
  it('does not rewrite a word made of roman letters ("mid" used to become "mcdxcix")', () => {
    expect(buildSequentialOverrides(5, 'mid', 8)).toEqual({ 5: 'mid' });
    expect(buildSequentialOverrides(5, 'dim', 8)).toEqual({ 5: 'dim' });
  });

  it('does not rewrite a variant spelling ("iiii" used to become "iv")', () => {
    expect(buildSequentialOverrides(4, 'iiii', 6)).toEqual({ 4: 'iiii' });
  });

  it('still continues a canonical numeral, in the case the user typed', () => {
    expect(buildSequentialOverrides(2, 'iv', 5)).toEqual({ 2: 'iv', 3: 'v', 4: 'vi', 5: 'vii' });
    expect(buildSequentialOverrides(1, 'IX', 3)).toEqual({ 1: 'IX', 2: 'X', 3: 'XI' });
  });
});
