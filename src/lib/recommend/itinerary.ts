import type { Category, PlaceSummary } from '@/lib/places/types';
import { recommend } from './select';
import type { RandomSource } from './select';
import type { Criteria } from './criteria';

/**
 * A date is a sequence, not a single destination.
 *
 * "Hẹn hò ở đâu" answered with one cafe leaves the harder half of the evening
 * unplanned. Three stops in an order that makes sense is a plan someone can follow
 * without thinking again — and it is far more worth sharing than a single name.
 */

export type ItinerarySlot = 'cafe' | 'hoat-dong' | 'an-toi';

export type SlotDefinition = {
  readonly slot: ItinerarySlot;
  readonly label: string;
  readonly emoji: string;
  readonly categories: readonly Category[];
};

/** Order is the order of the evening, and it is deliberate: talk, then do, then eat. */
export const ITINERARY_SLOTS: readonly SlotDefinition[] = [
  { slot: 'cafe', label: 'Cà phê', emoji: '☕', categories: ['cafe'] },
  {
    slot: 'hoat-dong',
    label: 'Đi chơi',
    emoji: '🚶',
    categories: ['outdoor', 'dating', 'entertainment', 'activity'],
  },
  { slot: 'an-toi', label: 'Ăn tối', emoji: '🍜', categories: ['food'] },
];

export type ItineraryStop = {
  readonly definition: SlotDefinition;
  readonly place: PlaceSummary;
};

export type Itinerary = {
  readonly stops: readonly ItineraryStop[];
  /** Sum of per-person averages across stops — the number people actually want. */
  readonly totalPrice: number | null;
  readonly totalMinutes: readonly [number, number] | null;
};

/**
 * Builds the plan one stop at a time, each pick constraining the next.
 *
 * After the first stop the district is pinned to wherever that stop is, so the
 * evening does not send anyone across the city twice. A slot with no candidate is
 * skipped rather than failing the whole plan: two good stops beat an error.
 */
export function composeItinerary(
  places: readonly PlaceSummary[],
  criteria: Criteria,
  options: { readonly random?: RandomSource; readonly now?: Date } = {},
): Itinerary | null {
  const { random = Math.random, now = new Date() } = options;

  const stops: ItineraryStop[] = [];
  const used = new Set(criteria.excludeIds ?? []);
  let districtId = criteria.districtId;

  for (const definition of ITINERARY_SLOTS) {
    const slotCriteria: Criteria = {
      ...criteria,
      categories: definition.categories,
      excludeIds: [...used],
      ...(districtId ? { districtId } : {}),
    };

    const result = recommend(places, slotCriteria, { random, now });
    if (!result) continue;

    const place = result.winner.place;
    stops.push({ definition, place });
    used.add(place.id);

    // Pin the neighbourhood to the first stop that landed.
    districtId ??= place.districtId;
  }

  // One stop is not an itinerary — fall back to the single-result flow instead.
  if (stops.length < 2) return null;

  const prices = stops.map((stop) => stop.place.avgPrice).filter((p): p is number => p !== undefined);
  const durations = stops
    .map((stop) => stop.place.durationMinutes)
    .filter((d): d is readonly [number, number] => d !== undefined);

  return {
    stops,
    totalPrice: prices.length === stops.length ? prices.reduce((a, b) => a + b, 0) : null,
    totalMinutes:
      durations.length === stops.length
        ? [
            durations.reduce((sum, [min]) => sum + min, 0),
            durations.reduce((sum, [, max]) => sum + max, 0),
          ]
        : null,
  };
}

/** Encodes an itinerary into a shareable, server-free URL. */
export function encodeItinerary(itinerary: Itinerary): string {
  return itinerary.stops.map((stop) => stop.place.slug).join(',');
}

export function decodeItinerarySlugs(value: string | null): readonly string[] {
  return (value ?? '')
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean)
    .slice(0, ITINERARY_SLOTS.length);
}
