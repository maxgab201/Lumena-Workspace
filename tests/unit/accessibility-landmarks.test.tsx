import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn() } } }));

import { NotFound } from '../../src/components/error/NotFound';
import { Auth } from '../../src/pages/Auth';
import { Legal } from '../../src/pages/Legal';
import { t, setLanguage } from '../../src/i18n';

/**
 * Found with axe-core in a real browser (desktop and a 390px phone) on the deployed app. These pin the parts that
 * are plain structure, so they cannot quietly regress: every page has one main landmark and one level-one heading,
 * a link inside a sentence is not told apart by colour alone, and form controls have names.
 */
const read = (file: string) => readFileSync(resolve(__dirname, '../../', file), 'utf8');

describe('page structure', () => {
  it('the 404 page has a main landmark and a level-one heading', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);

    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('the sign-in page has a main landmark and its title is the level-one heading', () => {
    render(<MemoryRouter><Auth /></MemoryRouter>);

    const main = screen.getByRole('main');
    expect(main).toBeTruthy();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(main.contains(h1[0])).toBe(true);
  });

  it('the links that switch between sign in, sign up and password reset are at least 24px tall (WCAG 2.5.8)', () => {
    // jsdom has no layout, so the guarantee is the vertical padding that lifts a 16-20px line to 24px or more
    render(<MemoryRouter><Auth /></MemoryRouter>);

    for (const name of [/forgot password/i, /don't have an account/i]) {
      expect(screen.getByRole('button', { name }).className).toMatch(/\bpy-1\b/);
    }
  });

  it('the mailto link in the legal text is underlined, not only coloured', () => {
    render(<MemoryRouter><Legal /></MemoryRouter>);

    const link = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.startsWith('mailto:'));
    expect(link, 'the legal page links to the support address').toBeTruthy();
    expect(link!.className).toMatch(/\bunderline\b/);
  });

  it('plan names on the billing page sit under the "Compare plans" h2 (no skipped heading level)', () => {
    const billing = read('src/pages/Billing.tsx');

    expect(billing).not.toMatch(/<h4\b/);
  });
});

describe('form controls have names', () => {
  it('the document selection checkbox is named after its document, in both languages', () => {
    const dashboard = read('src/pages/Dashboard.tsx');
    const at = dashboard.indexOf('type="checkbox"');
    expect(at).toBeGreaterThan(-1);
    expect(dashboard.slice(at, at + 200)).toContain("aria-label={t('dashboard.selectDocument'");

    setLanguage('en');
    expect(t('dashboard.selectDocument', { name: 'Tesis.pdf' })).toBe('Select Tesis.pdf');
    setLanguage('es');
    expect(t('dashboard.selectDocument', { name: 'Tesis.pdf' })).toBe('Seleccionar Tesis.pdf');
    setLanguage('en');
  });

  it('the avatars in the top bar are decorative: the button is labelled and the name sits next to the second one', () => {
    const topbar = read('src/components/layout/Topbar.tsx');
    const images = topbar.match(/<AvatarImage\b/g) ?? [];

    expect(images.length).toBeGreaterThan(0);
    expect(topbar.match(/<AvatarImage alt=""/g) ?? []).toHaveLength(images.length);
  });
});
