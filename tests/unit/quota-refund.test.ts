import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQuotaRefund, utcDay } from '../../supabase/functions/_shared/quota';

/**
 * ai-gateway takes one unit of the 50/day Free quota BEFORE it calls a provider. Production
 * evidence: when every provider failed, or the request was refused afterwards, the user lost the
 * unit and got no answer (19 of 50 units of the QA workspace in one day).
 */

afterEach(() => vi.restoreAllMocks());

describe('utcDay', () => {
  it('uses the UTC calendar day, as consume_ai_request does', () => {
    expect(utcDay(new Date('2026-10-01T00:00:00.000Z'))).toBe('2026-10-01');
    expect(utcDay(new Date('2026-09-30T23:59:59.999Z'))).toBe('2026-09-30');
    // 22:30 in Buenos Aires (UTC-3) is already the next day in UTC
    expect(utcDay(new Date('2026-09-30T22:30:00-03:00'))).toBe('2026-10-01');
  });
});

describe('createQuotaRefund', () => {
  it('gives the unit back for the workspace and the day it was taken on', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });

    await createQuotaRefund({ rpc }, 'ws-1', '2026-09-30')();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('refund_ai_request', { p_workspace_id: 'ws-1', p_day: '2026-09-30' });
  });

  it('refunds at most once, however many failure paths ask for it', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const refund = createQuotaRefund({ rpc }, 'ws-1');

    await refund();
    await refund();
    await refund();

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('never throws: a failed refund must not change the error the user is already getting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(createQuotaRefund({ rpc: vi.fn().mockResolvedValue({ error: { message: 'db down' } }) }, 'ws-1')()).resolves.toBeUndefined();
    await expect(createQuotaRefund({ rpc: vi.fn().mockRejectedValue(new Error('network')) }, 'ws-1')()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a refund that failed (the unit is not given back twice)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'db down' } });
    const refund = createQuotaRefund({ rpc }, 'ws-1');

    await refund();
    await refund();

    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('gateway refunds the unit on every failure after it was taken', () => {
  const gateway = readFileSync(resolve(__dirname, '../../supabase/functions/ai-gateway/index.ts'), 'utf8');
  const at = (needle: string) => {
    const index = gateway.indexOf(needle);
    expect(index, `"${needle}" must exist in ai-gateway`).toBeGreaterThan(-1);
    return index;
  };
  const refundJustBefore = (needle: string) => {
    const before = gateway.slice(Math.max(0, at(needle) - 160), at(needle));
    return before.includes('await refundQuota?.()');
  };

  it('arms the refund only once the quota was actually granted', () => {
    const consumed = at("rpc('consume_ai_request'");
    const armed = at('refundQuota = createQuotaRefund(');
    expect(armed).toBeGreaterThan(consumed);
    // after the "limit reached" refusal, so a refused request is never refunded for a unit it did not take
    expect(armed).toBeGreaterThan(at('Daily AI request limit reached'));
  });

  it('refunds when the request is refused after the quota was taken', () => {
    expect(refundJustBefore("'Rate limit exceeded. Try again later.'")).toBe(true);
    expect(refundJustBefore("'Daily credit cap reached. Circuit breaker tripped.'")).toBe(true);
    expect(refundJustBefore("'No allowed chat model is available for this plan.'")).toBe(true);
  });

  it('refunds when every provider failed (the final catch)', () => {
    const catchAt = at('} catch (err: any) {');
    expect(gateway.slice(catchAt, catchAt + 80)).toContain('await refundQuota?.()');
  });

  it('does NOT refund a prompt the user got blocked for (their own doing)', () => {
    expect(refundJustBefore("'Malicious prompt detected and blocked.'")).toBe(false);
  });
});

describe('refund_ai_request in the database', () => {
  const dir = resolve(__dirname, '../../supabase/migrations');
  const sql = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => readFileSync(resolve(dir, file), 'utf8'))
    .join('\n');

  it('exists, only lowers chat_count (never below zero) and is limited to the service role', () => {
    expect(sql).toMatch(/function public\.refund_ai_request\(p_workspace_id uuid, p_day date\)/i);
    expect(sql).toMatch(/chat_count = greatest\(chat_count - 1, 0\)/i);
    expect(sql).toMatch(/revoke all on function public\.refund_ai_request\(uuid, date\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.refund_ai_request\(uuid, date\) to service_role/i);
  });
});
