/**
 * The smallest IndexedDB wrapper that does the job.
 *
 * No library: this needs three operations on one object store, and every wrapper
 * worth using costs more in downloaded bytes than the cache it manages would save.
 *
 * Every call resolves rather than rejects. IndexedDB is unavailable in some private
 * windows, disabled when site data is blocked, and throws outright in a few embedded
 * webviews — none of which is worth breaking the page over, because there is always
 * a network to fall back to. A failed read is reported as a miss.
 */

const DB_NAME = 'ddd';
const DB_VERSION = 1;

export const CITY_SHARD_STORE = 'city-shards';
/** Itinerary-only fields, kept apart so the wizard's cache stays small. */
export const CITY_CARDS_STORE = 'city-cards';

const STORES = [CITY_SHARD_STORE, CITY_CARDS_STORE] as const;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise<IDBDatabase | null>((resolve) => {
    // `indexedDB` itself is missing in some webviews, and merely reading it can
    // throw when site data is blocked by policy.
    let request: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      // Guarded rather than assumed: this handler also runs when an older version
      // is being upgraded, where some stores already exist.
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Fires when another tab holds an older version open. Nothing useful to do but
    // carry on over the network.
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

export async function idbGet<T>(store: string, key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise<T | null>((resolve) => {
    try {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbPut(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value, key);
      // Resolving on either outcome: a write that failed — quota exceeded is the
      // likely one — costs nothing beyond a future cache miss.
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Exposed for tests, which need each case to start from a known state. */
export function resetIdbForTests(): void {
  dbPromise = null;
}
