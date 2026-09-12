import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CITY_SHARD_STORE, idbGet, idbPut } from '@/lib/storage/idb';
import { loadCityShard, resetShardCacheForTests } from './shard-client';
import { SHARD_MANIFEST } from './shard-manifest';

/**
 * The cache decides whether someone sees current data, so the cases that matter are
 * the ones where the stored copy is *wrong* — a deploy has moved on, or another
 * city's data is sitting under this city's key.
 */

vi.mock('@/lib/storage/idb', () => {
  const store = new Map<string, unknown>();
  return {
    CITY_SHARD_STORE: 'city-shards',
    CITY_CARDS_STORE: 'city-cards',
    idbGet: vi.fn((_store: string, key: string) => Promise.resolve(store.get(key) ?? null)),
    idbPut: vi.fn((_store: string, key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    __store: store,
  };
});

const CITY = 'ho-chi-minh';
const CURRENT_HASH = SHARD_MANIFEST[CITY]!.hash;

function shard(hash: string, cityId = CITY) {
  return { cityId, hash, districts: [{ id: 'q1' }], places: [{ slug: 'a' }] };
}

function mockFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn(() =>
    Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) } as Response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  resetShardCacheForTests();
  vi.mocked(idbGet).mockClear();
  vi.mocked(idbPut).mockClear();
  // Clear the fake store between cases.
  const mocked = (await import('@/lib/storage/idb')) as unknown as { __store: Map<string, unknown> };
  mocked.__store.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadCityShard', () => {
  it('fetches and caches when nothing is stored', async () => {
    const fetchMock = mockFetch(shard(CURRENT_HASH));

    const loaded = await loadCityShard(CITY);

    expect(loaded.hash).toBe(CURRENT_HASH);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(idbPut).toHaveBeenCalledWith(CITY_SHARD_STORE, CITY, expect.anything());
  });

  it('serves a stored copy without touching the network', async () => {
    await idbPut(CITY_SHARD_STORE, CITY, shard(CURRENT_HASH));
    const fetchMock = mockFetch(shard(CURRENT_HASH));

    await loadCityShard(CITY);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refetches when a deploy has changed the hash', async () => {
    // The shape is right and the city matches; only the content has moved on. This
    // is the case an expiry-based cache would get wrong for as long as its TTL.
    await idbPut(CITY_SHARD_STORE, CITY, shard('stale000'));
    const fetchMock = mockFetch(shard(CURRENT_HASH));

    const loaded = await loadCityShard(CITY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(loaded.hash).toBe(CURRENT_HASH);
  });

  it('refuses a stored copy belonging to a different city', async () => {
    await idbPut(CITY_SHARD_STORE, CITY, shard(CURRENT_HASH, 'ha-noi'));
    const fetchMock = mockFetch(shard(CURRENT_HASH));

    await loadCityShard(CITY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache a response whose hash does not match the manifest', async () => {
    // A CDN still serving the previous deploy. The data is usable now, but storing
    // it would keep the mismatch alive long after the CDN caught up.
    mockFetch(shard('older111'));

    const loaded = await loadCityShard(CITY);

    expect(loaded.hash).toBe('older111');
    expect(idbPut).not.toHaveBeenCalled();
  });

  it('makes one request when called twice before the first resolves', async () => {
    const fetchMock = mockFetch(shard(CURRENT_HASH));

    const [first, second] = await Promise.all([loadCityShard(CITY), loadCityShard(CITY)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('reports a failed request rather than resolving with nothing', async () => {
    mockFetch(null, false);

    await expect(loadCityShard(CITY)).rejects.toThrow(/HTTP 404/);
  });
});
