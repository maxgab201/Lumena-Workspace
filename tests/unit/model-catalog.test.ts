import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GEMINI_FREE_WHITELIST,
  UNMETERED_PRICING,
  resolveChatPricing,
} from '../../supabase/functions/_shared/modelCatalog';

/**
 * Production evidence (2026-09-30): every Free-plan chat request answered 500.
 *  - The Free Gemini models declared by the catalog had no row in provider_models, and the
 *    gateway refuses a model it cannot price ("Model X not found or inactive").
 *  - The seeded OpenRouter ':free' model had been retired upstream but was still offered.
 *  - The ':free' models the catalog discovers at runtime can never have a registry row.
 */

describe('resolveChatPricing', () => {
  const registered = {
    id: 'model-uuid',
    provider_pricing: [{ input_price_per_1k: 0.5, output_price_per_1k: 1, credit_conversion_rate: 100 }],
  };

  it('uses the registry price when the model is registered', () => {
    expect(resolveChatPricing(registered, { tier: 'pro' })).toEqual({
      modelId: 'model-uuid',
      pricing: registered.provider_pricing[0],
    });
    // the registry wins even for a Free model
    expect(resolveChatPricing(registered, { tier: 'free' })?.modelId).toBe('model-uuid');
  });

  it('runs an unregistered Free model unmetered, without a registry id', () => {
    expect(resolveChatPricing(null, { tier: 'free' })).toEqual({ modelId: null, pricing: UNMETERED_PRICING });
    expect(resolveChatPricing(undefined, { tier: 'free' })?.modelId).toBeNull();
    // a registry row that has no price behaves like a missing one
    expect(resolveChatPricing({ id: 'x', provider_pricing: [] }, { tier: 'free' })?.modelId).toBeNull();
  });

  it('never runs a Pro or unknown model that has no price', () => {
    expect(resolveChatPricing(null, { tier: 'pro' })).toBeNull();
    expect(resolveChatPricing(null, undefined)).toBeNull();
    expect(resolveChatPricing({ id: 'x', provider_pricing: [] }, { tier: 'pro' })).toBeNull();
    expect(resolveChatPricing({ id: 'x', provider_pricing: null }, undefined)).toBeNull();
  });

  it('unmetered pricing costs nothing', () => {
    expect(UNMETERED_PRICING.input_price_per_1k).toBe(0);
    expect(UNMETERED_PRICING.output_price_per_1k).toBe(0);
  });
});

describe('getCatalog with OpenRouter discovery', () => {
  const NEX = 'nex-agi/nex-n2.5-pro:free';

  const openRouterList = (ids: string[]) =>
    new Response(JSON.stringify({ data: ids.map((id) => ({ id, name: id })) }), { status: 200 });

  async function catalogWith(fetchImpl: () => Promise<Response>) {
    vi.resetModules(); // the catalog memoises in module state
    vi.stubGlobal('fetch', vi.fn(fetchImpl));
    const { getCatalog } = await import('../../supabase/functions/_shared/modelCatalog');
    return getCatalog();
  }

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops offering a seeded OpenRouter model the live list no longer has', async () => {
    const catalog = await catalogWith(async () => openRouterList(['qwen/qwen3.8-27b:free', 'paid/model']));

    expect(catalog.find((m) => m.model_id === NEX)?.available).toBe(false);
    const live = catalog.find((m) => m.model_id === 'qwen/qwen3.8-27b:free');
    expect(live).toMatchObject({ provider: 'openrouter', tier: 'free', available: true });
    // only ':free' ids are discovered
    expect(catalog.some((m) => m.model_id === 'paid/model')).toBe(false);
  });

  it('keeps the seeded model offered while the live list still has it', async () => {
    const catalog = await catalogWith(async () => openRouterList([NEX]));
    expect(catalog.find((m) => m.model_id === NEX)?.available).toBe(true);
  });

  it('does not hide anything when OpenRouter cannot be reached', async () => {
    const catalog = await catalogWith(async () => {
      throw new Error('network down');
    });
    expect(catalog.find((m) => m.model_id === NEX)?.available).toBe(true);
  });

  it('does not hide anything when OpenRouter answers with an empty list', async () => {
    const catalog = await catalogWith(async () => openRouterList([]));
    expect(catalog.find((m) => m.model_id === NEX)?.available).toBe(true);
  });

  it('leaves the Gemini models available when ListModels is unreachable', async () => {
    const catalog = await catalogWith(async () => openRouterList(['a/b:free']));
    for (const id of GEMINI_FREE_WHITELIST) {
      expect(catalog.find((m) => m.model_id === id)?.available).toBe(true);
    }
  });
});

describe('provider registry seeds', () => {
  const migrationsDir = resolve(__dirname, '../../supabase/migrations');
  const allMigrations = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(resolve(migrationsDir, f), 'utf8'))
    .join('\n');

  it.each([...GEMINI_FREE_WHITELIST])('registers the Free Gemini model %s in provider_models', (code) => {
    // A Free model without a registry row cannot be priced, so the gateway refuses it.
    const inserts = allMigrations.match(/insert into public\.provider_models[\s\S]*?;/gi) ?? [];
    expect(inserts.some((statement) => statement.includes(`'${code}'`))).toBe(true);
  });
});
