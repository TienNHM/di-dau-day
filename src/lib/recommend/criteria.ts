import { COMPANIONS, PRICE_RANGES, TAGS } from '@/lib/places/types';
import type { Category, Companion, PriceRange, Tag } from '@/lib/places/types';
import type { LatLng } from '@/lib/geo/haversine';

/**
 * What the user asked for.
 *
 * Everything is optional: the wizard must be able to produce a result from a
 * partially answered flow, because the whole promise is a result in 15 seconds.
 */
export type Criteria = {
  readonly categories?: readonly Category[];
  readonly companion?: Companion;
  readonly budget?: PriceRange;
  readonly tags?: readonly Tag[];
  readonly districtId?: string;
  /** Usually the selected district's centroid; a real GPS fix only if the user opts in. */
  readonly origin?: LatLng;
  /** Hard filter: drop places known to be closed right now. */
  readonly openNow?: boolean;
  /**
   * Never widen beyond `districtId`, even when it holds too few places.
   *
   * Set by the itinerary composer: an evening that sends someone across the city
   * between stops is not an evening, so a missing slot is better than a distant one.
   * The single-place flow leaves this off, where widening a thin district is
   * preferable to returning the same place on every reroll.
   */
  readonly strictDistrict?: boolean;
  /** Place ids to skip — how "Chọn lại" avoids repeating the last few results. */
  readonly excludeIds?: readonly string[];
};

/**
 * Query-string keys. Vietnamese and short, because these URLs get shared and read
 * by humans: `?ai=nguoi-yeu&vi=100-300k` is self-explanatory in a way `?c=2&b=1` is not.
 */
const KEYS = {
  companion: 'ai',
  budget: 'vi',
  district: 'quan',
  tags: 'thich',
  openNow: 'mo',
  /** Which intent produced this result — only used to flavour the result page copy. */
  intent: 'tu',
} as const;

/**
 * Which city a shared link belongs to.
 *
 * Not part of `Criteria`: it selects which data file to read rather than how to
 * score within it. The itinerary page needs it because a plan is three slugs with
 * no city attached, and looking them up in the wrong city's shard finds nothing.
 * Absent on links shared before this existed, which fall back to the stored
 * preference — those all came from TP.HCM, the only city the wizard then served.
 */
export const CITY_QUERY_KEY = 'tp';

export const CRITERIA_QUERY_KEYS = KEYS;

function asMember<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/**
 * Reads criteria out of a URL.
 *
 * Unknown values are dropped rather than rejected: a stale or hand-edited link
 * should still produce a result, just a less targeted one.
 */
export function decodeCriteria(params: URLSearchParams): Criteria {
  const companion = asMember(params.get(KEYS.companion), COMPANIONS);
  const budget = asMember(params.get(KEYS.budget), PRICE_RANGES);
  const district = params.get(KEYS.district) ?? undefined;

  const tags = (params.get(KEYS.tags) ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag): tag is Tag => (TAGS as readonly string[]).includes(tag));

  return {
    ...(companion ? { companion } : {}),
    ...(budget ? { budget } : {}),
    ...(district ? { districtId: district } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(params.get(KEYS.openNow) === '1' ? { openNow: true } : {}),
  };
}

/** Inverse of `decodeCriteria`. Empty values are omitted so URLs stay short. */
export function encodeCriteria(criteria: Criteria, intent?: string): URLSearchParams {
  const params = new URLSearchParams();

  if (intent) params.set(KEYS.intent, intent);
  if (criteria.companion) params.set(KEYS.companion, criteria.companion);
  if (criteria.budget) params.set(KEYS.budget, criteria.budget);
  if (criteria.districtId) params.set(KEYS.district, criteria.districtId);
  if (criteria.tags && criteria.tags.length > 0) params.set(KEYS.tags, criteria.tags.join(','));
  if (criteria.openNow) params.set(KEYS.openNow, '1');

  return params;
}

export function readIntentId(params: URLSearchParams): string | null {
  return params.get(KEYS.intent);
}
