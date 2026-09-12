import { PRICE_RANGES } from '@/lib/places/types';
import type { PlaceSummary } from '@/lib/places/types';
import { haversineKm } from '@/lib/geo/haversine';
import { isOpenAt } from '@/lib/time/open-now';
import type { OpenState } from '@/lib/time/open-now';
import type { Criteria } from './criteria';

/**
 * Deterministic scoring. No AI, no I/O, no framework imports — a pure function
 * over data, which is what makes it unit-testable and portable to a server later.
 *
 * The goal is not to be right. It is to keep obviously-wrong answers out of the
 * candidate pool, so the weighted random pick that follows can feel like discovery
 * rather than noise.
 *
 * Criteria the user did not give contribute nothing *and* are removed from the
 * denominator. Awarding every place full marks for an unasked question would add a
 * large constant to every score, compressing the differences that actually matter
 * and making a relative cutoff meaningless.
 */

export const WEIGHTS = {
  category: 30,
  companion: 20,
  tags: 15,
  budget: 15,
  distance: 10,
  popularity: 7,
  openNow: 3,
  /** Capped, and only applied to places that already qualify. See `applySponsoredBoost`. */
  sponsoredMax: 8,
} as const;

/** Beyond this, distance stops discriminating — everything far is equally far. */
const DISTANCE_FALLOFF_KM = 12;

/** Scores are normalised to 0–100 so the pool cutoff and the boost cap mean the same thing everywhere. */
export const MAX_SCORE = 100;

/** `max: 0` marks a criterion the user did not express, which drops out of the denominator. */
type Component = { readonly points: number; readonly max: number };

const NOT_ASKED: Component = { points: 0, max: 0 };

/**
 * Credit given when the user asked about something the place has no data for.
 *
 * Imported places carry no price or companion information. Scoring them zero would
 * bury every one of them beneath the hand-curated few; scoring them full would let
 * unknowns outrank places we know actually fit. Half is the honest answer: the
 * question still counts, and the place is neither rewarded nor punished for a gap
 * in our data rather than a property of the place itself.
 */
const UNKNOWN_RATIO = 0.5;

export type ScoreBreakdown = {
  readonly category: Component;
  readonly companion: Component;
  readonly tags: Component;
  readonly budget: Component;
  readonly distance: Component;
  readonly popularity: Component;
  readonly openNow: Component;
};

export type ScoredPlace = {
  readonly place: PlaceSummary;
  /** Normalised 0–100 (a sponsored place may exceed 100 by at most the boost cap). */
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
  readonly sponsoredBoost: number;
  readonly openState: OpenState;
  readonly distanceKm: number | null;
};

function scoreCategory(place: PlaceSummary, criteria: Criteria): Component {
  if (!criteria.categories || criteria.categories.length === 0) return NOT_ASKED;
  return {
    points: criteria.categories.includes(place.category) ? WEIGHTS.category : 0,
    max: WEIGHTS.category,
  };
}

function scoreCompanion(place: PlaceSummary, criteria: Criteria): Component {
  if (!criteria.companion) return NOT_ASKED;
  if (!place.goodFor) return { points: UNKNOWN_RATIO * WEIGHTS.companion, max: WEIGHTS.companion };

  return {
    points: place.goodFor.includes(criteria.companion) ? WEIGHTS.companion : 0,
    max: WEIGHTS.companion,
  };
}

function scoreTags(place: PlaceSummary, criteria: Criteria): Component {
  const wanted = criteria.tags ?? [];
  if (wanted.length === 0) return NOT_ASKED;

  const matched = wanted.filter((tag) => place.tags.includes(tag)).length;
  return { points: (matched / wanted.length) * WEIGHTS.tags, max: WEIGHTS.tags };
}

/**
 * Budget matching is deliberately asymmetric.
 *
 * Cheaper than asked is a mild mismatch — nobody is upset that dinner cost less.
 * More expensive than asked is a real failure: the user told us what they can
 * spend, and a result they cannot afford is worse than no result.
 */
function scoreBudget(place: PlaceSummary, criteria: Criteria): Component {
  if (!criteria.budget) return NOT_ASKED;
  if (!place.priceRange) return { points: UNKNOWN_RATIO * WEIGHTS.budget, max: WEIGHTS.budget };

  const wanted = PRICE_RANGES.indexOf(criteria.budget);
  const actual = PRICE_RANGES.indexOf(place.priceRange);
  const delta = actual - wanted;

  const ratio = delta === 0 ? 1 : delta === -1 ? 0.75 : delta <= -2 ? 0.5 : delta === 1 ? 0.35 : 0;

  return { points: ratio * WEIGHTS.budget, max: WEIGHTS.budget };
}

function scoreDistance(
  place: PlaceSummary,
  criteria: Criteria,
): { component: Component; distanceKm: number | null } {
  const distanceKm = criteria.origin
    ? haversineKm(criteria.origin, { lat: place.lat, lng: place.lng })
    : null;

  // An explicit district choice is a stronger signal than raw distance: someone who
  // picks Bình Thạnh wants Bình Thạnh, not a marginally closer spot in Phú Nhuận.
  if (criteria.districtId) {
    const sameDistrict = place.districtId === criteria.districtId;
    if (sameDistrict) {
      return { component: { points: WEIGHTS.distance, max: WEIGHTS.distance }, distanceKm };
    }
    if (!criteria.origin) {
      return { component: { points: 0, max: WEIGHTS.distance }, distanceKm };
    }
  }

  if (distanceKm === null) return { component: NOT_ASKED, distanceKm: null };

  const closeness = Math.max(0, 1 - distanceKm / DISTANCE_FALLOFF_KM);
  return { component: { points: closeness * WEIGHTS.distance, max: WEIGHTS.distance }, distanceKm };
}

/**
 * Popularity and open-now always apply: they are editorial priors rather than
 * answers to a question, and they are what breaks ties when the user gave us little.
 */
function scorePopularity(place: PlaceSummary): Component {
  return { points: (place.popularity / 100) * WEIGHTS.popularity, max: WEIGHTS.popularity };
}

/** Unknown hours score at half credit — missing data should not be treated as closed. */
function scoreOpenNow(state: OpenState): Component {
  const ratio = state === 'open' ? 1 : state === 'unknown' ? 0.5 : 0;
  return { points: ratio * WEIGHTS.openNow, max: WEIGHTS.openNow };
}

export function scorePlace(place: PlaceSummary, criteria: Criteria, now = new Date()): ScoredPlace {
  const openState = isOpenAt(place.openingHours, now);
  const distance = scoreDistance(place, criteria);

  const breakdown: ScoreBreakdown = {
    category: scoreCategory(place, criteria),
    companion: scoreCompanion(place, criteria),
    tags: scoreTags(place, criteria),
    budget: scoreBudget(place, criteria),
    distance: distance.component,
    popularity: scorePopularity(place),
    openNow: scoreOpenNow(openState),
  };

  const components = Object.values(breakdown);
  const points = components.reduce((sum, component) => sum + component.points, 0);
  const maxPossible = components.reduce((sum, component) => sum + component.max, 0);

  return {
    place,
    score: maxPossible > 0 ? (points / maxPossible) * MAX_SCORE : 0,
    breakdown,
    sponsoredBoost: 0,
    openState,
    distanceKm: distance.distanceKm,
  };
}

/**
 * Sponsorship boost — applied only after qualification, and capped.
 *
 * The cap means a sponsored place can move up among places the user would have been
 * happy with anyway, but can never drag an irrelevant place into the results: a
 * category mismatch alone costs far more than the boost can return. That limit is
 * the product — undisclosed or unbounded paid placement would make every
 * recommendation suspect, and trust is the only asset this product has.
 *
 * The result card always shows a "Được tài trợ" badge alongside this.
 */
export function applySponsoredBoost(scored: ScoredPlace): ScoredPlace {
  if (!scored.place.isSponsored) return scored;

  return {
    ...scored,
    score: scored.score + WEIGHTS.sponsoredMax,
    sponsoredBoost: WEIGHTS.sponsoredMax,
  };
}
