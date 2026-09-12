import canThoRaw from '@data/cities/can-tho.json';
import daLatRaw from '@data/cities/da-lat.json';
import daNangRaw from '@data/cities/da-nang.json';
import haNoiRaw from '@data/cities/ha-noi.json';
import haiPhongRaw from '@data/cities/hai-phong.json';
import hoChiMinhRaw from '@data/cities/ho-chi-minh.json';
import hueRaw from '@data/cities/hue.json';
import nhaTrangRaw from '@data/cities/nha-trang.json';
import vungTauRaw from '@data/cities/vung-tau.json';
import importedCanThoRaw from '@data/places/imported/can-tho.json';
import importedDaLatRaw from '@data/places/imported/da-lat.json';
import importedDaNangRaw from '@data/places/imported/da-nang.json';
import importedHaNoiRaw from '@data/places/imported/ha-noi.json';
import importedHaiPhongRaw from '@data/places/imported/hai-phong.json';
import importedHoChiMinhRaw from '@data/places/imported/ho-chi-minh.json';
import importedHueRaw from '@data/places/imported/hue.json';
import importedNhaTrangRaw from '@data/places/imported/nha-trang.json';
import importedVungTauRaw from '@data/places/imported/vung-tau.json';
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

const CITY_SOURCES = [
  ['data/cities/ho-chi-minh.json', hoChiMinhRaw],
  ['data/cities/ha-noi.json', haNoiRaw],
  ['data/cities/da-nang.json', daNangRaw],
  ['data/cities/da-lat.json', daLatRaw],
  ['data/cities/nha-trang.json', nhaTrangRaw],
  ['data/cities/can-tho.json', canThoRaw],
  ['data/cities/hue.json', hueRaw],
  ['data/cities/hai-phong.json', haiPhongRaw],
  ['data/cities/vung-tau.json', vungTauRaw],
] as const;

const PLACE_SOURCES = [
  ['data/places/food.json', foodRaw],
  ['data/places/cafe.json', cafeRaw],
  ['data/places/entertainment.json', entertainmentRaw],
  ['data/places/outdoor.json', outdoorRaw],
  ['data/places/dating.json', datingRaw],
  ['data/places/family.json', familyRaw],
  ['data/places/activity.json', activityRaw],

  // Imported last so a curated record always wins a slug race — the curated slug is
  // the one that may already be shared, and the import reserves around it anyway.
  ['data/places/imported/ho-chi-minh.json', importedHoChiMinhRaw],
  ['data/places/imported/ha-noi.json', importedHaNoiRaw],
  ['data/places/imported/da-nang.json', importedDaNangRaw],
  ['data/places/imported/da-lat.json', importedDaLatRaw],
  ['data/places/imported/nha-trang.json', importedNhaTrangRaw],
  ['data/places/imported/can-tho.json', importedCanThoRaw],
  ['data/places/imported/hue.json', importedHueRaw],
  ['data/places/imported/hai-phong.json', importedHaiPhongRaw],
  ['data/places/imported/vung-tau.json', importedVungTauRaw],
] as const;

let citiesCache: City[] | null = null;
let placesCache: Place[] | null = null;

function loadCities(): City[] {
  citiesCache ??= CITY_SOURCES.map(([source, raw]) => parseCity(raw, source));
  return citiesCache;
}

function loadPlaces(): Place[] {
  if (placesCache) return placesCache;

  const cities = loadCities();
  if (cities.length === 0) throw new Error('Không có thành phố nào trong seed data');

  const all: Place[] = [];
  const seenSlugs = new Map<string, string>();

  for (const [source, raw] of PLACE_SOURCES) {
    for (const place of parsePlaces(raw, source, cities)) {
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

    if (filter.cityId) {
      places = places.filter((place) => place.location.cityId === filter.cityId);
    }

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
