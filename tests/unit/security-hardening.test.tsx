import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../../src/components/chat/ChatMessage';

/**
 * Assistant output is model text built from untrusted PDF content, so it is hostile input. It is
 * rendered through react-markdown without raw HTML; these pin that, so that adding a rehype-raw
 * plugin or a custom link renderer cannot quietly reopen script injection.
 */
const assistant = (content: string) =>
  render(<ChatMessage message={{ id: 'm1', session_id: 's1', role: 'assistant', content, created_at: '2026-01-01T00:00:00Z' } as never} />);

describe('chat message rendering', () => {
  it('does not turn raw HTML from the model into elements', () => {
    const { container } = assistant('hola <img src=x onerror="window.__xss=1"> <script>window.__xss=2</script> <b onmouseover="window.__xss=3">negrita</b>');

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onerror], [onmouseover]')).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it('neutralises javascript: and data: links', () => {
    const { container } = assistant('[uno](javascript:window.__xss=4) [dos](data:text/html;base64,PHNjcmlwdD4=) [tres](vbscript:msgbox(1))');

    for (const link of Array.from(container.querySelectorAll('a'))) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^\s*(javascript|data|vbscript):/i);
    }
  });

  it('opens real links in a new tab without handing over window.opener', () => {
    assistant('[sitio](https://example.com/pagina)');

    const link = screen.getByRole('link', { name: 'sitio' });
    expect(link.getAttribute('href')).toBe('https://example.com/pagina');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
  });
});

describe('hosting security headers (vercel.json)', () => {
  const config = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8')) as {
    headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    rewrites?: Array<{ source: string; destination: string }>;
  };
  const sent = Object.fromEntries(
    (config.headers ?? []).filter((rule) => rule.source === '/(.*)').flatMap((rule) => rule.headers).map((h) => [h.key.toLowerCase(), h.value]),
  );

  it('forbids framing, MIME sniffing and leaking the full referrer', () => {
    expect(sent['x-frame-options']).toBe('DENY');
    expect(sent['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(sent['x-content-type-options']).toBe('nosniff');
    expect(sent['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('turns off camera, microphone and geolocation, which the app never uses', () => {
    expect(sent['permissions-policy']).toMatch(/camera=\(\)/);
    expect(sent['permissions-policy']).toMatch(/microphone=\(\)/);
    expect(sent['permissions-policy']).toMatch(/geolocation=\(\)/);
  });

  it('keeps the SPA fallback rewrite', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });
});
