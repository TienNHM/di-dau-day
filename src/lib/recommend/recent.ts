'use client';

/**
 * Short-term memory of what was already suggested, so "Chọn lại" does not hand back
 * the place the user just rejected. Getting the same answer twice in a row is the
 * fastest way to make the whole thing feel broken.
 *
 * sessionStorage, not localStorage: this should reset when the tab closes. Yesterday's
 * suggestion is a perfectly good answer today, and permanently burning through the
 * catalogue would leave a returning user with only the dregs.
 */

const KEY = 'ddd:recent';
const MAX_REMEMBERED = 3;

/** Storage can throw in private mode or when site data is blocked; never break the flow over it. */
function safely<T>(operation: () => T, fallback: T): T {
  try {
    return operation();
  } catch {
    return fallback;
  }
}

export function readRecentIds(): readonly string[] {
  return safely(() => {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  }, []);
}

export function rememberResult(placeId: string): void {
  safely(() => {
    const next = [placeId, ...readRecentIds().filter((id) => id !== placeId)].slice(
      0,
      MAX_REMEMBERED,
    );
    sessionStorage.setItem(KEY, JSON.stringify(next));
  }, undefined);
}

export function clearRecent(): void {
  safely(() => sessionStorage.removeItem(KEY), undefined);
}
