import { describe, expect, it } from 'vitest';
import { applySponsoredBoost, scorePlace, WEIGHTS } from './score';
import type { PlaceSummary } from '@/lib/places/types';

function place(overrides: Partial<PlaceSummary> = {}): PlaceSummary {
  return {
    id: 'p1',
    slug: 'p1',
    name: 'Test',
    category: 'outdoor',
    tags: ['chill'],
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

describe('scorePlace', () => {
  it('gives no category credit to a place outside the requested categories', () => {
    const scored = scorePlace(place({ category: 'food' }), { categories: ['cafe'] });
    expect(scored.breakdown.category.points).toBe(0);
  });

  it('drops unasked criteria out of the score entirely, rather than awarding constants', () => {
    // A constant awarded to every place would inflate all scores equally and
    // compress the differences the candidate cutoff depends on.
    const scored = scorePlace(place(), {});
    for (const key of ['category', 'companion', 'tags', 'budget'] as const) {
      expect(scored.breakdown[key]).toEqual({ points: 0, max: 0 });
    }
  });

  it('still ranks on editorial priors when the user answered nothing', () => {
    const popular = scorePlace(place({ popularity: 95 }), {});
    const obscure = scorePlace(place({ popularity: 5 }), {});
    expect(popular.score).toBeGreaterThan(obscure.score);
  });

  it('scores tags by the share of requested tags present', () => {
    const scored = scorePlace(place({ tags: ['chill', 'yen-tinh'] }), {
      tags: ['chill', 'yen-tinh', 'view-dep'],
    });
    expect(scored.breakdown.tags.points).toBeCloseTo((2 / 3) * WEIGHTS.tags);
  });

  describe('budget', () => {
    it('rewards an exact bracket match fully', () => {
      const scored = scorePlace(place({ priceRange: '100-300k' }), { budget: '100-300k' });
      expect(scored.breakdown.budget.points).toBe(WEIGHTS.budget);
    });

    it('treats cheaper than asked more kindly than more expensive than asked', () => {
      const cheaper = scorePlace(place({ priceRange: 'under-100k' }), { budget: '100-300k' });
      const pricier = scorePlace(place({ priceRange: '300-500k' }), { budget: '100-300k' });
      expect(cheaper.breakdown.budget.points).toBeGreaterThan(pricier.breakdown.budget.points);
    });

    it('gives nothing to a place two brackets over budget', () => {
      const scored = scorePlace(place({ priceRange: 'over-500k' }), { budget: 'under-100k' });
      expect(scored.breakdown.budget.points).toBe(0);
    });
  });

  describe('companion', () => {
    it('gives nothing when the place does not suit the companion', () => {
      const scored = scorePlace(place({ goodFor: ['gia-dinh'] }), { companion: 'nguoi-yeu' });
      expect(scored.breakdown.companion.points).toBe(0);
    });
  });

  describe('distance', () => {
    it('gives full credit for a place in the chosen district', () => {
      const scored = scorePlace(place({ districtId: 'quan-7' }), { districtId: 'quan-7' });
      expect(scored.breakdown.distance.points).toBe(WEIGHTS.distance);
    });

    it('decays with distance from the origin', () => {
      const near = scorePlace(place({ lat: 10.78, lng: 106.7 }), {
        origin: { lat: 10.7769, lng: 106.7009 },
      });
      const far = scorePlace(place({ lat: 10.41, lng: 106.95 }), {
        origin: { lat: 10.7769, lng: 106.7009 },
      });
      expect(near.breakdown.distance.points).toBeGreaterThan(far.breakdown.distance.points);
      expect(far.breakdown.distance.points).toBe(0);
    });

    it('reports the distance it used, for display on the result card', () => {
      const scored = scorePlace(place(), { origin: { lat: 10.7769, lng: 106.7009 } });
      expect(scored.distanceKm).toBeCloseTo(0, 1);
    });
  });

  describe('open now', () => {
    const monday9am = new Date('2026-09-14T02:00:00Z'); // 09:00 Asia/Ho_Chi_Minh

    it('credits a place that is open', () => {
      const scored = scorePlace(
        place({ openingHours: { default: [['07:00', '22:00']] } }),
        {},
        monday9am,
      );
      expect(scored.openState).toBe('open');
      expect(scored.breakdown.openNow.points).toBe(WEIGHTS.openNow);
    });

    it('gives half credit when hours are unknown, rather than treating it as closed', () => {
      const scored = scorePlace(place(), {}, monday9am);
      expect(scored.openState).toBe('unknown');
      expect(scored.breakdown.openNow.points).toBe(WEIGHTS.openNow * 0.5);
    });

    it('gives nothing to a closed place', () => {
      const scored = scorePlace(
        place({ openingHours: { default: [['18:00', '23:00']] } }),
        {},
        monday9am,
      );
      expect(scored.openState).toBe('closed');
      expect(scored.breakdown.openNow.points).toBe(0);
    });
  });
});

describe('applySponsoredBoost', () => {
  it('leaves an unsponsored place untouched', () => {
    const scored = scorePlace(place(), {});
    expect(applySponsoredBoost(scored)).toBe(scored);
  });

  it('adds a capped boost to a sponsored place', () => {
    const scored = scorePlace(place({ isSponsored: true }), {});
    const boosted = applySponsoredBoost(scored);
    expect(boosted.score - scored.score).toBe(WEIGHTS.sponsoredMax);
  });

  it('cannot lift an irrelevant place above a relevant one', () => {
    // Sponsorship must never override the user's actual request. A sponsored place
    // in the wrong category loses 30 points of category weight; the 8-point cap
    // cannot close that gap.
    const relevant = scorePlace(place({ category: 'cafe' }), { categories: ['cafe'] });
    const sponsoredButWrong = applySponsoredBoost(
      scorePlace(place({ category: 'food', isSponsored: true }), { categories: ['cafe'] }),
    );
    expect(sponsoredButWrong.score).toBeLessThan(relevant.score);
  });
});
