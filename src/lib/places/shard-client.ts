import { BASE_PATH } from '@/lib/site';
import { CITY_CARDS_STORE, CITY_SHARD_STORE, idbGet, idbPut } from '@/lib/storage/idb';
import { SHARD_MANIFEST } from './shard-manifest';
import { cardsPath, shardPath } from './shard';
import type { CityCards, CityShard } from './shard';

/**
 * Loads one city's data in the browser, through three tiers.
 *
 * 1. **Memory** — the same city asked for twice in one session, which is what
 *    happens when someone runs the wizard again or switches intent.
 * 2. **IndexedDB** — a repeat visit, and the only tier that survives a reload. The
 *    payload is stored as a structured clone rather than as text, so a hit also skips
 *    parsing 326 KB of JSON, not just downloading it.
 * 3. **Network** — first visit to a city, or after a deploy changed the data.
 *
 * Freshness comes from the content hash in the build-time manifest, not from an
 * expiry: a cached copy is used while its hash matches and discarded the moment a
 * deploy changes it. There is no window in which someone is shown stale places, and
 * no revalidation request in the common case where nothing changed.
 */

type Cached = { readonly cityId: string; readonly hash: string };

/** Concurrent callers share one request rather than racing to fetch the same city. */
const memory = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * How one kind of cached payload is addressed and checked.
 *
 * The tie between a spec and its payload type is held by the two exported wrappers
 * below and nowhere else, which is why they sit next to each other: pairing the
 * wrong spec with the wrong type is the one mistake this shape cannot catch.
 */
type Spec = {
  readonly store: string;
  readonly path: (cityId: string) => string;
  readonly expectedHash: (cityId: string) => string | undefined;
  readonly isShaped: (value: object) => boolean;
};

const SHARD: Spec = {
  store: CITY_SHARD_STORE,
  path: shardPath,
  expectedHash: (cityId) => SHARD_MANIFEST[cityId]?.hash,
  isShaped: (value) =>
    Array.isArray((value as Partial<CityShard>).places) &&
    Array.isArray((value as Partial<CityShard>).districts),
};

const CARDS: Spec = {
  store: CITY_CARDS_STORE,
  path: cardsPath,
  expectedHash: (cityId) => SHARD_MANIFEST[cityId]?.cardsHash,
  isShaped: (value) => Array.isArray((value as Partial<CityCards>).extras),
};

function isCurrent<T extends Cached>(value: unknown, cityId: string, spec: Spec): value is T {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Cached>;
  return (
    candidate.cityId === cityId &&
    candidate.hash === spec.expectedHash(cityId) &&
    spec.isShaped(value)
  );
}

async function fetchFresh<T extends Cached>(cityId: string, spec: Spec): Promise<T> {
  const response = await fetch(`${BASE_PATH}${spec.path(cityId)}`, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Không tải được dữ liệu ${cityId} (HTTP ${response.status})`);
  }

  const payload = (await response.json()) as T;
  if (!isCurrent<T>(payload, cityId, spec)) {
    // A hash mismatch here means the served file is older than this JavaScript — a
    // CDN or a service worker still holding a previous deploy. The data is usable,
    // so it is returned; it is only refused a place in the cache, where a stale
    // copy would outlive the mismatch.
    return payload;
  }

  void idbPut(spec.store, cityId, payload);
  return payload;
}

function load<T extends Cached>(cityId: string, spec: Spec): Promise<T> {
  const key = `${spec.store}:${cityId}`;

  const cached = memory.get(key);
  if (cached) return Promise.resolve(cached as T);

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    const stored = await idbGet<T>(spec.store, cityId);
    if (isCurrent<T>(stored, cityId, spec)) return stored;
    return fetchFresh<T>(cityId, spec);
  })()
    .then((value) => {
      memory.set(key, value);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

/** Summaries and districts — everything the wizard scores against. */
export function loadCityShard(cityId: string): Promise<CityShard> {
  return load(cityId, SHARD);
}

/** Addresses and editorial notes, for the itinerary page only. */
export function loadCityCards(cityId: string): Promise<CityCards> {
  return load(cityId, CARDS);
}

/**
 * Warms the cache without waiting for it.
 *
 * Called as soon as a wizard mounts, so the download overlaps the ten-odd seconds
 * someone spends answering questions that need no data at all. By the time the
 * district question — the first that does — is on screen, the shard has usually
 * been there for several seconds.
 */
export function prefetchCityShard(cityId: string): void {
  void loadCityShard(cityId).catch(() => {
    // Prefetching is opportunistic; the real load will surface any error.
  });
}

/** Exposed for tests, which must not inherit another case's cache. */
export function resetShardCacheForTests(): void {
  memory.clear();
  inFlight.clear();
}
