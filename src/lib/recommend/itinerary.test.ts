import { describe, expect, it } from 'vitest';
import { composeItinerary, decodeItinerarySlugs, encodeItinerary } from './itinerary';
import type { Category, PlaceSummary } from '@/lib/places/types';

function place(id: string, category: Category, overrides: Partial<PlaceSummary> = {}): PlaceSummary {
  return {
    id,
    slug: id,
    name: id,
    category,
    tags: [],
    goodFor: ['nguoi-yeu'],
    priceRange: '100-300k',
    cityId: 'ho-chi-minh',
    districtId: 'quan-1',
    lat: 10.7769,
    lng: 106.7009,
    popularity: 50,
    isSponsored: false,
    avgPrice: 100000,
    durationMinutes: [60, 90],
    ...overrides,
  };
}

const FULL_SET = [
  place('cafe-a', 'cafe'),
  place('park-a', 'outdoor'),
  place('food-a', 'food'),
];

describe('composeItinerary', () => {
  it('builds cafe, activity then dinner, in that order', () => {
    const itinerary = composeItinerary(FULL_SET, {}, { random: () => 0 });
    expect(itinerary?.stops.map((stop) => stop.definition.slot)).toEqual([
      'cafe',
      'hoat-dong',
      'an-toi',
    ]);
  });

  it('never repeats a place across stops', () => {
    const itinerary = composeItinerary(FULL_SET, {}, { random: () => 0 });
    const ids = itinerary?.stops.map((stop) => stop.place.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the evening in one neighbourhood once the first stop is chosen', () => {
    // The only cafe is in Quận 7, so the rest of the plan should favour Quận 7 too.
    const places = [
      place('cafe-q7', 'cafe', { districtId: 'quan-7' }),
      place('park-q7', 'outdoor', { districtId: 'quan-7', popularity: 10 }),
      place('park-far', 'outdoor', { districtId: 'can-gio', popularity: 90 }),
      place('food-q7', 'food', { districtId: 'quan-7' }),
    ];

    const itinerary = composeItinerary(places, {}, { random: () => 0 });
    const districts = itinerary?.stops.map((stop) => stop.place.districtId) ?? [];
    expect(new Set(districts)).toEqual(new Set(['quan-7']));
  });

  it('skips a slot with no candidate rather than failing the whole plan', () => {
    const itinerary = composeItinerary(
      [place('cafe-a', 'cafe'), place('food-a', 'food')],
      {},
      { random: () => 0 },
    );
    expect(itinerary?.stops.map((stop) => stop.definition.slot)).toEqual(['cafe', 'an-toi']);
  });

  it('returns null when only one stop can be filled, since that is not an itinerary', () => {
    expect(composeItinerary([place('cafe-a', 'cafe')], {}, { random: () => 0 })).toBeNull();
  });

  it('sums price and duration across stops', () => {
    const itinerary = composeItinerary(FULL_SET, {}, { random: () => 0 });
    expect(itinerary?.totalPrice).toBe(300000);
    expect(itinerary?.totalMinutes).toEqual([180, 270]);
  });

  it('reports no total when any stop is missing a price, rather than understating it', () => {
    const places = [
      place('cafe-a', 'cafe'),
      place('park-a', 'outdoor', { avgPrice: undefined }),
      place('food-a', 'food'),
    ];
    expect(composeItinerary(places, {}, { random: () => 0 })?.totalPrice).toBeNull();
  });

  it('respects excluded ids from a previous reroll', () => {
    const places = [
      place('cafe-a', 'cafe'),
      place('cafe-b', 'cafe'),
      place('park-a', 'outdoor'),
      place('food-a', 'food'),
    ];
    const itinerary = composeItinerary(places, { excludeIds: ['cafe-a'] }, { random: () => 0 });
    expect(itinerary?.stops[0]?.place.id).toBe('cafe-b');
  });
});

describe('itinerary URL codec', () => {
  it('round-trips the slugs', () => {
    const itinerary = composeItinerary(FULL_SET, {}, { random: () => 0 });
    const encoded = encodeItinerary(itinerary!);
    expect(decodeItinerarySlugs(encoded)).toEqual(['cafe-a', 'park-a', 'food-a']);
  });

  it('tolerates a missing or malformed parameter', () => {
    expect(decodeItinerarySlugs(null)).toEqual([]);
    expect(decodeItinerarySlugs(',, ,')).toEqual([]);
  });

  it('caps the number of stops a URL can claim', () => {
    expect(decodeItinerarySlugs('a,b,c,d,e')).toHaveLength(3);
  });
});
