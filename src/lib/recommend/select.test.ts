import { describe, expect, it } from 'vitest';
import { CANDIDATE_POOL_SIZE, pickWeighted, recommend, recommendWithFallback } from './select';
import { scorePlace } from './score';
import type { PlaceSummary } from '@/lib/places/types';

function place(id: string, overrides: Partial<PlaceSummary> = {}): PlaceSummary {
  return {
    id,
    slug: id,
    name: id,
    category: 'outdoor',
    tags: [],
    goodFor: ['ban-be'],
    priceRange: '100-300k',
    districtId: 'quan-1',
    lat: 10.7769,
    lng: 106.7009,
    popularity: 50,
    isSponsored: false,
    ...overrides,
  };
}

/** Deterministic random source, so selection behaviour is assertable. */
function sequence(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe('pickWeighted', () => {
  it('returns null for an empty pool', () => {
    expect(pickWeighted([])).toBeNull();
  });

  it('picks the first candidate when the draw lands at the start', () => {
    const candidates = [place('a'), place('b')].map((p) => scorePlace(p, {}));
    expect(pickWeighted(candidates, () => 0)?.place.id).toBe('a');
  });

  it('reaches lower-scoring candidates when the draw lands near the end', () => {
    const candidates = [place('a'), place('b')].map((p) => scorePlace(p, {}));
    expect(pickWeighted(candidates, () => 0.999)?.place.id).toBe('b');
  });

  it('still returns a candidate when every score is zero', () => {
    const zeroed = [place('a'), place('b')].map((p) => ({
      ...scorePlace(p, {}),
      score: 0,
    }));
    expect(pickWeighted(zeroed, () => 0.5)).not.toBeNull();
  });
});

describe('recommend', () => {
  it('returns null when nothing survives filtering', () => {
    const result = recommend([place('a', { category: 'food' })], { categories: ['cafe'] });
    expect(result).toBeNull();
  });

  it('excludes ids the caller asked to skip, so "Chọn lại" does not repeat', () => {
    const places = [place('a'), place('b')];
    const result = recommend(places, { excludeIds: ['a'] }, { random: () => 0 });
    expect(result?.winner.place.id).toBe('b');
    expect(result?.candidates.map((c) => c.place.id)).not.toContain('a');
  });

  it('drops closed places when the user asked for open-now', () => {
    const places = [
      place('closed', { openingHours: { default: [['18:00', '23:00']] } }),
      place('open', { openingHours: { default: [['07:00', '22:00']] } }),
    ];
    const monday9am = new Date('2026-09-14T02:00:00Z');

    const result = recommend(places, { openNow: true }, { random: () => 0, now: monday9am });
    expect(result?.candidates.map((c) => c.place.id)).toEqual(['open']);
  });

  it('keeps places with unknown hours under open-now, since missing data is not closure', () => {
    const places = [place('unknown')];
    const result = recommend(places, { openNow: true }, { random: () => 0 });
    expect(result?.winner.place.id).toBe('unknown');
  });

  it('caps the candidate pool', () => {
    const places = Array.from({ length: 30 }, (_, i) => place(`p${i}`));
    const result = recommend(places, {}, { random: () => 0 });
    expect(result?.candidates.length).toBeLessThanOrEqual(CANDIDATE_POOL_SIZE);
    expect(result?.totalConsidered).toBe(30);
  });

  it('drops weak matches from the pool rather than padding it', () => {
    const places = [
      place('strong', { goodFor: ['nguoi-yeu'], priceRange: 'under-100k', popularity: 90 }),
      place('weak', { goodFor: ['gia-dinh'], priceRange: 'over-500k', popularity: 5 }),
    ];
    const result = recommend(places, { companion: 'nguoi-yeu', budget: 'under-100k' });
    expect(result?.candidates.map((c) => c.place.id)).toEqual(['strong']);
  });

  it('produces different winners across draws, so two people get different answers', () => {
    const places = Array.from({ length: 8 }, (_, i) => place(`p${i}`, { popularity: 50 }));
    const winners = new Set(
      [0.05, 0.35, 0.65, 0.95].map(
        (draw) => recommend(places, {}, { random: () => draw })?.winner.place.id,
      ),
    );
    expect(winners.size).toBeGreaterThan(1);
  });

  it('ranks candidates by score, best first', () => {
    const places = [
      place('low', { popularity: 60 }),
      place('high', { popularity: 100 }),
      place('mid', { popularity: 80 }),
    ];
    const result = recommend(places, {}, { random: sequence(0) });
    expect(result?.candidates.map((c) => c.place.id)).toEqual(['high', 'mid', 'low']);
  });
});

describe('recommendWithFallback', () => {
  it('returns a result without relaxing anything when the criteria already match', () => {
    const outcome = recommendWithFallback([place('a')], {}, { random: () => 0 });
    expect(outcome?.relaxed).toEqual([]);
  });

  it('drops constraints one at a time until something matches', () => {
    // Only a closed place exists, so open-now must be relaxed to answer at all.
    const places = [place('a', { openingHours: { default: [['18:00', '23:00']] } })];
    const monday9am = new Date('2026-09-14T02:00:00Z');

    const outcome = recommendWithFallback(
      places,
      { openNow: true },
      { random: () => 0, now: monday9am },
    );

    expect(outcome?.relaxed).toEqual(['openNow']);
    expect(outcome?.result.winner.place.id).toBe('a');
  });

  it('relaxes district before budget, since location is easier to give up than money', () => {
    const places = [place('a', { districtId: 'quan-7', priceRange: 'under-100k' })];
    const outcome = recommendWithFallback(
      places,
      { districtId: 'can-gio', budget: 'under-100k' },
      { random: () => 0 },
    );

    // District scoring is soft, so a match exists without relaxing at all — the point
    // is that budget is never dropped while a district-based answer is still possible.
    expect(outcome?.relaxed).not.toContain('budget');
  });

  it('returns null only when no place can satisfy even the relaxed criteria', () => {
    const outcome = recommendWithFallback([place('a', { category: 'food' })], {
      categories: ['cafe'],
    });
    expect(outcome).toBeNull();
  });
});
