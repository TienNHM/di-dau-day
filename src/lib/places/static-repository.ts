import hoChiMinhRaw from '@data/cities/ho-chi-minh.json';
import activityRaw from '@data/places/activity.json';
import cafeRaw from '@data/places/cafe.json';
import datingRaw from '@data/places/dating.json';
import entertainmentRaw from '@data/places/entertainment.json';
import familyRaw from '@data/places/family.json';
import foodRaw from '@data/places/food.json';
import outdoorRaw from '@data/places/outdoor.json';
import { parseCity, parsePlaces } from './schema';
import type { PlaceFilter, PlaceRepository } from './repository';
import type { City, District, Place } from './types';

/**
 * MVP implementation: seed JSON bundled at build time.
 *
 * Validation runs once, lazily, and throws on bad data. During `next build` that
 * surfaces as a failed build — which is the point: a malformed seed record should
 * never reach production, where it would just quietly never match anything.
 */

const SOURCES = [
  ['data/places/food.json', foodRaw],
  ['data/places/cafe.json', cafeRaw],
  ['data/places/entertainment.json', entertainmentRaw],
  ['data/places/outdoor.json', outdoorRaw],
  ['data/places/dating.json', datingRaw],
  ['data/places/family.json', familyRaw],
  ['data/places/activity.json', activityRaw],
] as const;

let citiesCache: City[] | null = null;
let placesCache: Place[] | null = null;

function loadCities(): City[] {
  citiesCache ??= [parseCity(hoChiMinhRaw, 'data/cities/ho-chi-minh.json')];
  return citiesCache;
}

function loadPlaces(): Place[] {
  if (placesCache) return placesCache;

  const cities = loadCities();
  const city = cities[0];
  if (!city) throw new Error('Không có thành phố nào trong seed data');

  const all: Place[] = [];
  const seenSlugs = new Map<string, string>();

  for (const [source, raw] of SOURCES) {
    for (const place of parsePlaces(raw, source, city)) {
      // parsePlaces guarantees uniqueness within a file; this catches collisions
      // across files, which is the likelier mistake when a place is recategorised.
      const previous = seenSlugs.get(place.slug);
      if (previous) {
        throw new Error(`Slug "${place.slug}" xuất hiện ở cả ${previous} và ${source}`);
      }
      seenSlugs.set(place.slug, source);
      all.push(place);
    }
  }

  placesCache = all;
  return all;
}

export class StaticPlaceRepository implements PlaceRepository {
  async listCities(): Promise<City[]> {
    return loadCities();
  }

  async getCity(cityId: string): Promise<City | null> {
    return loadCities().find((city) => city.id === cityId) ?? null;
  }

  async listPlaces(filter: PlaceFilter = {}): Promise<Place[]> {
    let places = loadPlaces().filter((place) => place.status === 'active');

    if (filter.categories && filter.categories.length > 0) {
      const wanted = new Set(filter.categories);
      places = places.filter((place) => wanted.has(place.category));
    }

    if (filter.districtId) {
      places = places.filter((place) => place.location.districtId === filter.districtId);
    }

    return places;
  }

  async getPlaceBySlug(slug: string): Promise<Place | null> {
    return loadPlaces().find((place) => place.slug === slug) ?? null;
  }

  async getDistrict(cityId: string, districtId: string): Promise<District | null> {
    const city = await this.getCity(cityId);
    return city?.districts.find((district) => district.id === districtId) ?? null;
  }
}

const repository: PlaceRepository = new StaticPlaceRepository();

/**
 * The single place that decides where data comes from. Swapping in an API-backed
 * repository later is a change to this function only.
 */
export function getPlaceRepository(): PlaceRepository {
  return repository;
}
