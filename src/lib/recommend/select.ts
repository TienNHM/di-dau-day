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

export type Recommendation = {
  readonly winner: ScoredPlace;
  /** Top scorers including the winner — the reel shows these, so they must be real. */
  readonly candidates: readonly ScoredPlace[];
  readonly totalConsidered: number;
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

  let scored = eligible.map((place) => applySponsoredBoost(scorePlace(place, criteria, now)));

  // "Đang mở cửa" is a hard filter, not a bonus: a closed place is not an answer to
  // "đi đâu bây giờ". Unknown hours survive, since missing data is not evidence of closure.
  if (criteria.openNow) {
    scored = scored.filter((candidate) => candidate.openState !== 'closed');
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);

  const leader = scored[0];
  if (!leader) return null;

  const floor = leader.score * RELATIVE_FLOOR;
  const candidates = scored
    .slice(0, CANDIDATE_POOL_SIZE)
    .filter((candidate) => candidate.score >= floor);

  const winner = pickWeighted(candidates, random) ?? leader;

  return { winner, candidates, totalConsidered: scored.length };
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
