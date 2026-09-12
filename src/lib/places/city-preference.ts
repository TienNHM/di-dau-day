'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_CITY_ID } from '@/lib/site';

/**
 * Which city the visitor is in.
 *
 * localStorage, not sessionStorage: unlike "what have I already been shown today",
 * the city someone lives in does not change between visits, and asking again every
 * session would be a pointless tax on the fifteen-second promise.
 *
 * Exposed through `useSyncExternalStore` rather than an effect that calls setState.
 * The stored value cannot exist during prerender, and this is the API built for
 * exactly that gap: it renders the server snapshot, then swaps to the real value on
 * hydration without a mismatch warning and without a wasted render pass.
 *
 * Every access is guarded — storage throws in private mode and when site data is
 * blocked, and remembering a city is never worth breaking the page over.
 */

const KEY = 'ddd:city';

const listeners = new Set<() => void>();
let cached: string | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the city should be reflected here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cached = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Cached because useSyncExternalStore requires a stable snapshot between renders. */
function getSnapshot(): string {
  if (cached !== null) return cached;
  try {
    cached = localStorage.getItem(KEY) ?? DEFAULT_CITY_ID;
  } catch {
    cached = DEFAULT_CITY_ID;
  }
  return cached;
}

function getServerSnapshot(): string {
  return DEFAULT_CITY_ID;
}

export function useCityPreference(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function writeCityPreference(cityId: string): void {
  cached = cityId;
  try {
    localStorage.setItem(KEY, cityId);
  } catch {
    // Nothing to do: the choice simply will not be remembered next visit.
  }
  for (const listener of listeners) listener();
}
