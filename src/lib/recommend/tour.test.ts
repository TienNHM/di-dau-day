import { describe, expect, it } from 'vitest';
import { composeTour } from './itinerary';
import { haversineKm } from '@/lib/geo/haversine';
import type { PlaceSummary } from '@/lib/places/types';

/**
 * A tour is judged on three things: it has the right number of stops, they are near
 * each other, and they are not all the same kind of thing. The order is judged on
 * not being obviously silly.
 */

function place(
  name: string,
  lat: number,
  lng: number,
  subCategory: string,
  category: PlaceSummary['category'] = 'outdoor',
): PlaceSummary {
  return {
    id: name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    category,
    subCategory,
    tags: [],
    cityId: 'ho-chi-minh',
    districtId: 'quan-1',
    lat,
    lng,
    popularity: 60,
    isSponsored: false,
  };
}

/** Downtown TP.HCM, all within a couple of kilometres of each other. */
const CLUSTER: PlaceSummary[] = [
  place('Bảo tàng Mỹ thuật', 10.769, 106.698, 'museum'),
  place('Công viên Tao Đàn', 10.774, 106.692, 'park'),
  place('Chợ Bến Thành', 10.772, 106.698, 'market', 'shopping'),
  place('Nhà hát Thành phố', 10.777, 106.703, 'theatre', 'entertainment'),
  place('Thảo Cầm Viên', 10.788, 106.705, 'zoo', 'family'),
  place('Bưu điện Thành phố', 10.78, 106.699, 'landmark-and-historical-building'),
];

const fixedRandom = () => 0.5;

describe('composeTour', () => {
  it('produces the requested number of stops', () => {
    const tour = composeTour(CLUSTER, {}, 5, { random: fixedRandom });
    expect(tour?.stops).toHaveLength(5);
  });

  it('does not repeat a place', () => {
    const tour = composeTour(CLUSTER, {}, 5, { random: fixedRandom });
    const ids = tour!.stops.map((stop) => stop.place.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prefers a different kind of place at each stop', () => {
    // Five temples in a row is technically a tour and nobody would follow it.
    const tour = composeTour(CLUSTER, {}, 4, { random: fixedRandom });
    const kinds = tour!.stops.map((stop) => stop.place.subCategory);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('leaves out anywhere too far to belong on the same day', () => {
    const faraway = place('Địa đạo Củ Chi', 11.14, 106.46, 'historic-site');
    const tour = composeTour([...CLUSTER, faraway], {}, 5, { random: fixedRandom });
    expect(tour!.stops.map((stop) => stop.place.name)).not.toContain('Địa đạo Củ Chi');
  });

  it('does not open with a long hop when a shorter start exists', () => {
    // The failure this replaced: seeding on the edge of the cluster forced the route
    // to begin with a 5.5km leg, then double back. Starting anywhere else is shorter.
    const outlier = place('Snow Town', 10.803, 106.742, 'theme-park', 'family');
    const tour = composeTour([outlier, ...CLUSTER], {}, 5, { random: fixedRandom })!;

    const legs = tour.stops
      .slice(1)
      .map((stop, index) => haversineKm(tour.stops[index]!.place, stop.place));
    const total = legs.reduce((sum, leg) => sum + leg, 0);

    // Walking the same five places from the outlier costs about 10km.
    expect(total).toBeLessThan(9);
  });

  it('orders stops so each is the nearest one still unvisited', () => {
    const tour = composeTour(CLUSTER, {}, 4, { random: fixedRandom });
    const stops = tour!.stops;

    for (let i = 0; i + 2 < stops.length; i += 1) {
      const here = stops[i]!.place;
      const next = haversineKm(here, stops[i + 1]!.place);
      // Every stop still ahead must be at least as far as the one chosen next.
      for (let j = i + 2; j < stops.length; j += 1) {
        expect(next).toBeLessThanOrEqual(haversineKm(here, stops[j]!.place) + 1e-9);
      }
    }
  });

  it('leaves out shopping that is an errand rather than a destination', () => {
    // Overture files an appliance warehouse and a landmark mall under one category,
    // so a route once opened at Nguyễn Kim, which sells refrigerators.
    const appliances = place('Nguyễn Kim Bình Thạnh', 10.771, 106.699, 'shopping-center', 'shopping');
    const market = place('Chợ Bà Chiểu', 10.772, 106.697, 'market', 'shopping');
    const tour = composeTour([appliances, market, ...CLUSTER], {}, 5, { random: fixedRandom })!;
    const names = tour.stops.map((stop) => stop.place.name);

    expect(names).not.toContain('Nguyễn Kim Bình Thạnh');
  });

  it('never tours restaurants', () => {
    const withFood = [...CLUSTER, place('Phở Lệ', 10.77, 106.697, 'pho', 'food')];
    const tour = composeTour(withFood, {}, 5, { random: fixedRandom });
    expect(tour!.stops.every((stop) => stop.place.category !== 'food')).toBe(true);
  });

  it('gives up rather than calling one place a route', () => {
    expect(composeTour([CLUSTER[0]!], {}, 3, { random: fixedRandom })).toBeNull();
  });

  it('returns nothing when there is nowhere to go', () => {
    expect(composeTour([], {}, 3, { random: fixedRandom })).toBeNull();
  });
});
