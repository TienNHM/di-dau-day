import type { PlaceSummary } from '@/lib/places/types';
import { applySponsoredBoost, scorePlace } from './score';
import type { ScoredPlace } from './score';
import type { Criteria } from './criteria';

/**
 * Candidate pool size.
 *
 * Small enough that everything in it is genuinely a good answer, large enough that
 * two people with identical answers get different results — which is what makes the
 * spin feel like discovery instead of a lookup table.
 */
export const CANDIDATE_POOL_SIZE = 12;

/**
 * Places scoring below this fraction of the pool leader are dropped even if the pool
 * has room. Padding a thin result set with bad matches is worse than a short reel.
 */
const RELATIVE_FLOOR = 0.55;

/**
 * Below this many candidates a district is too thin to answer on its own, and
 * insisting on it would mean returning the same two places forever.
 */
const MIN_DISTRICT_POOL = 3;

export type Recommendation = {
  readonly winner: ScoredPlace;
  /** Top scorers including the winner — the reel shows these, so they must be real. */
  readonly candidates: readonly ScoredPlace[];
  readonly totalConsidered: number;
  /**
   * True when the chosen district could not fill a pool and the search widened.
   * Surfaced to the user rather than hidden — being sent across town without
   * explanation is exactly the failure this flag exists to prevent.
   */
  readonly districtRelaxed: boolean;
};

export type RandomSource = () => number;

/**
 * Weighted random over the candidate pool, weighted by score squared.
 *
 * Squaring keeps the best matches clearly favoured while leaving real room for the
 * rest — a plain argmax would return the same place to everyone forever, and a
 * uniform pick would make the scoring pointless.
 */
export function pickWeighted(
  candidates: readonly ScoredPlace[],
  random: RandomSource = Math.random,
): ScoredPlace | null {
  if (candidates.length === 0) return null;

  const weights = candidates.map((candidate) => Math.max(candidate.score, 0) ** 2);
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  // Degenerate case: every candidate scored zero. Fall back to a uniform pick
  // rather than returning nothing.
  if (total <= 0) {
    const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    return candidates[index] ?? null;
  }

  let threshold = random() * total;
  for (const [index, weight] of weights.entries()) {
    threshold -= weight;
    if (threshold <= 0) return candidates[index] ?? null;
  }

  return candidates.at(-1) ?? null;
}

/**
 * The engine entry point: filter → score → shortlist → weighted random.
 *
 * Returns `null` only when nothing survives filtering, which callers must handle by
 * relaxing the criteria rather than showing a dead end.
 */
export function recommend(
  places: readonly PlaceSummary[],
  criteria: Criteria,
  options: { readonly random?: RandomSource; readonly now?: Date } = {},
): Recommendation | null {
  const { random = Math.random, now = new Date() } = options;

  const excluded = new Set(criteria.excludeIds ?? []);

  const eligible = places.filter((place) => {
    if (excluded.has(place.id)) return false;
    if (criteria.categories && criteria.categories.length > 0) {
      if (!criteria.categories.includes(place.category)) return false;
    }
    return true;
  });

  /**
   * A chosen district is a near-hard filter, not a scoring nudge.
   *
   * Distance is worth 10 of roughly 80 available points, so a place that matches
   * every tag and the budget perfectly outscores a decent local option from ten
   * kilometres away — which is how "tôi ở Thủ Đức" came back with a quán in Quận 1.
   * Someone who names their district has told us where they are willing to go, and
   * no amount of tag matching makes a cross-town answer correct.
   *
   * The district pool is only abandoned when it genuinely cannot answer.
   */
  const scoreAll = (pool: readonly PlaceSummary[], against: Criteria) => {
    let scored = pool.map((place) => applySponsoredBoost(scorePlace(place, against, now)));

    // "Đang mở cửa" is a hard filter, not a bonus: a closed place is not an answer
    // to "đi đâu bây giờ". Unknown hours survive, since missing data is not
    // evidence of closure.
    if (against.openNow) {
      scored = scored.filter((candidate) => candidate.openState !== 'closed');
    }

    return scored.sort((a, b) => b.score - a.score);
  };

  let districtRelaxed = false;
  let scored: ScoredPlace[];

  if (criteria.districtId) {
    const local = scoreAll(
      eligible.filter((place) => place.districtId === criteria.districtId),
      criteria,
    );

    if (local.length >= MIN_DISTRICT_POOL || criteria.strictDistrict) {
      scored = local;
    } else {
      // Too thin to answer on its own: insisting would hand back the same one or two
      // places on every reroll. Widen, and say so rather than quietly relocating the user.
      //
      // The district is dropped from the criteria as well as the filter. Keeping it
      // would leave every out-of-district place scoring zero on distance, so the
      // relative floor would cut them all and "widening" would return the same
      // single place it was meant to escape.
      districtRelaxed = true;
      const { districtId: _dropped, ...widened } = criteria;
      scored = scoreAll(eligible, widened);
    }
  } else {
    scored = scoreAll(eligible, criteria);
  }

  if (scored.length === 0) return null;

  const leader = scored[0];
  if (!leader) return null;

  const floor = leader.score * RELATIVE_FLOOR;
  const candidates = scored
    .slice(0, CANDIDATE_POOL_SIZE)
    .filter((candidate) => candidate.score >= floor);

  const winner = pickWeighted(candidates, random) ?? leader;

  return { winner, candidates, totalConsidered: scored.length, districtRelaxed };
}

/**
 * Progressive relaxation.
 *
 * Dropping constraints one at a time — the most restrictive first — is how the wizard
 * avoids a dead end. A slightly-off suggestion beats "không tìm thấy gì", which would
 * end the session on the exact question the product exists to answer.
 */
export function recommendWithFallback(
  places: readonly PlaceSummary[],
  criteria: Criteria,
  options: { readonly random?: RandomSource; readonly now?: Date } = {},
): { result: Recommendation; relaxed: readonly (keyof Criteria)[] } | null {
  const relaxations: (keyof Criteria)[] = ['openNow', 'districtId', 'tags', 'budget', 'companion'];

  let current = criteria;
  const relaxed: (keyof Criteria)[] = [];

  for (;;) {
    const result = recommend(places, current, options);
    if (result) return { result, relaxed };

    const next = relaxations[relaxed.length];
    if (!next) return null;

    relaxed.push(next);
    const { [next]: _dropped, ...rest } = current;
    current = rest;
  }
}
