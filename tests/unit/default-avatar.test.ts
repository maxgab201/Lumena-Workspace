import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultAvatarUrl } from '../../src/lib/avatar';

/**
 * The default avatar is drawn by a third party (dicebear.com), so whatever seeds it travels to that
 * third party in the URL, on every page the signed-in user opens. It used to be the user's email.
 */
describe('default avatar', () => {
  it('is seeded with the user id and never with the email', () => {
    const url = defaultAvatarUrl('0da68007-d15c-49eb-b431-6cecbb6c7759');

    expect(url).toBe('https://api.dicebear.com/7.x/notionists/svg?seed=0da68007-d15c-49eb-b431-6cecbb6c7759');
    expect(url).not.toContain('@');
  });

  it('encodes the seed, so characters in it cannot add query parameters', () => {
    expect(defaultAvatarUrl('a&b=c d')).toBe('https://api.dicebear.com/7.x/notionists/svg?seed=a%26b%3Dc%20d');
  });

  it('has no avatar to ask for before the user is known', () => {
    expect(defaultAvatarUrl(undefined)).toBeUndefined();
    expect(defaultAvatarUrl(null)).toBeUndefined();
    expect(defaultAvatarUrl('')).toBeUndefined();
  });

  it('the top bar does not put the email in any URL', () => {
    const topbar = readFileSync(resolve(__dirname, '../../src/components/layout/Topbar.tsx'), 'utf8');

    expect(topbar).not.toMatch(/dicebear[^\n]*\$\{[^}]*email/);
    expect(topbar).toContain('defaultAvatarUrl(');
  });
});
