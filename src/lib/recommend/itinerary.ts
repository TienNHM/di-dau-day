import type { Category, PlaceSummary } from '@/lib/places/types';
import { recommend } from './select';
import { haversineKm } from '@/lib/geo/haversine';
import type { RandomSource } from './select';
import type { Criteria } from './criteria';

/**
 * A date is a sequence, not a single destination.
 *
 * "Hẹn hò ở đâu" answered with one cafe leaves the harder half of the evening
 * unplanned. Three stops in an order that makes sense is a plan someone can follow
 * without thinking again — and it is far more worth sharing than a single name.
 */

export type ItinerarySlot = 'cafe' | 'hoat-dong' | 'an-toi' | 'diem';

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
      // Strict: the second and third stops must stay where the first one landed.
      ...(districtId ? { districtId, strictDistrict: true } : {}),
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

/**
 * A day out, as a route rather than a script.
 *
 * The evening plan above is a template: coffee, then something to do, then dinner, in
 * that order because that is how an evening goes. Sightseeing has no such shape — a
 * museum, a park and a market are interchangeable in a way that dinner and coffee are
 * not — so a tour is chosen for variety and then ordered by geography.
 */
export const TOUR_SIZES = [3, 4, 5] as const;
export type TourSize = (typeof TOUR_SIZES)[number];

/** Categories worth building a day around. Food is excluded: nobody tours restaurants. */
const TOUR_CATEGORIES: readonly Category[] = ['outdoor', 'family', 'entertainment', 'shopping'];

/**
 * Which shopping counts as somewhere to go.
 *
 * `shopping_center` covers both a landmark mall and an appliance warehouse, and
 * Overture gives no way to tell them apart — a generated route opened at "Nguyễn Kim
 * Bình Thạnh", which sells refrigerators. Markets and bookshops are destinations in
 * their own right; the rest is an errand, so shopping is allowed in only by name.
 */
const TOUR_SHOPPING_SUBS: readonly string[] = [
  'night-market',
  'market',
  'farmers-market',
  'flea-market',
  'bookstore',
];

function tourEligible(place: PlaceSummary): boolean {
  if (place.category !== 'shopping') return true;
  return place.subCategory !== undefined && TOUR_SHOPPING_SUBS.includes(place.subCategory);
}

/**
 * How far a tour may wander from its first stop.
 *
 * A day out that crosses a city twice is not a day out. Six kilometres is roughly the
 * radius inside which stops stay plausibly linked by a short taxi ride, and it is
 * generous enough that a thinly covered city can still fill five slots.
 */
const TOUR_RADIUS_KM = 6;

function totalsFor(stops: readonly ItineraryStop[]) {
  const prices = stops.map((stop) => stop.place.avgPrice).filter((p): p is number => p !== undefined);
  const durations = stops
    .map((stop) => stop.place.durationMinutes)
    .filter((d): d is readonly [number, number] => d !== undefined);

  return {
    totalPrice: prices.length === stops.length ? prices.reduce((a, b) => a + b, 0) : null,
    totalMinutes:
      durations.length === stops.length
        ? ([
            durations.reduce((sum, [min]) => sum + min, 0),
            durations.reduce((sum, [, max]) => sum + max, 0),
          ] as const)
        : null,
  };
}

/** Nearest neighbour from a given starting stop. */
function walkFrom(stops: readonly ItineraryStop[], startAt: number): ItineraryStop[] {
  const remaining = [...stops];
  const ordered: ItineraryStop[] = [];

  let current = remaining.splice(startAt, 1)[0];
  while (current) {
    ordered.push(current);
    const from = current.place;

    let nearestAt = -1;
    let nearestKm = Infinity;
    remaining.forEach((candidate, index) => {
      const km = haversineKm(from, candidate.place);
      if (km < nearestKm) {
        nearestKm = km;
        nearestAt = index;
      }
    });

    current = nearestAt === -1 ? undefined : remaining.splice(nearestAt, 1)[0];
  }

  return ordered;
}

function pathLengthKm(stops: readonly ItineraryStop[]): number {
  let total = 0;
  for (let i = 1; i < stops.length; i += 1) {
    total += haversineKm(stops[i - 1]!.place, stops[i]!.place);
  }
  return total;
}

/**
 * Orders stops into a route somebody would actually walk or ride.
 *
 * Nearest neighbour, but tried from every stop rather than fixed to the first. The
 * first version always began at the seed, and when the seed sat on the edge of the
 * cluster the route opened with a 5.5 km hop, spent three stops inside one kilometre,
 * then doubled back 3.5 km — ten kilometres for five places in one city.
 *
 * Still not the shortest possible route; that is the travelling salesman and for five
 * stops the remaining difference is metres. Trying each start is `n` cheap walks and
 * removes the failure anybody would actually notice.
 */
function orderByProximity(stops: readonly ItineraryStop[]): ItineraryStop[] {
  let best = walkFrom(stops, 0);
  let bestKm = pathLengthKm(best);

  for (let start = 1; start < stops.length; start += 1) {
    const candidate = walkFrom(stops, start);
    const km = pathLengthKm(candidate);
    if (km < bestKm) {
      best = candidate;
      bestKm = km;
    }
  }

  return best;
}

export function composeTour(
  places: readonly PlaceSummary[],
  criteria: Criteria,
  size: TourSize,
  options: { readonly random?: RandomSource; readonly now?: Date } = {},
): Itinerary | null {
  const { random = Math.random, now = new Date() } = options;

  const base: Criteria = { ...criteria, categories: TOUR_CATEGORIES };
  const pool = places.filter(tourEligible);
  const used = new Set(criteria.excludeIds ?? []);
  // One of each kind of thing before any repeats: five temples is not a day out.
  const usedGroups = new Set<string>();
  const picked: PlaceSummary[] = [];

  const seed = recommend(pool, { ...base, excludeIds: [...used] }, { random, now });
  if (!seed) return null;

  picked.push(seed.winner.place);
  used.add(seed.winner.place.id);
  usedGroups.add(seed.winner.place.subCategory ?? seed.winner.place.category);

  while (picked.length < size) {
    const anchor = picked[0]!;
    const nearby = pool.filter((place) => haversineKm(anchor, place) <= TOUR_RADIUS_KM);

    // Prefer something different; fall back to any nearby place rather than stopping
    // short, because a four-stop tour beats a three-stop one with a hole in it.
    const fresh = nearby.filter(
      (place) => !usedGroups.has(place.subCategory ?? place.category),
    );

    const next =
      recommend(fresh, { ...base, excludeIds: [...used] }, { random, now }) ??
      recommend(nearby, { ...base, excludeIds: [...used] }, { random, now });

    if (!next) break;

    picked.push(next.winner.place);
    used.add(next.winner.place.id);
    usedGroups.add(next.winner.place.subCategory ?? next.winner.place.category);
  }

  if (picked.length < 2) return null;

  const definition: SlotDefinition = {
    slot: 'diem',
    label: 'Điểm dừng',
    emoji: '📍',
    categories: TOUR_CATEGORIES,
  };

  const stops = orderByProximity(picked.map((place) => ({ definition, place })));
  return { stops, ...totalsFor(stops) };
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
    // Capped at the longest plan we produce, not at the dating template's three.
    .slice(0, Math.max(ITINERARY_SLOTS.length, ...TOUR_SIZES));
}
