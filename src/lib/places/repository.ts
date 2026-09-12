import type { Category, City, District, Place } from './types';

/**
 * The one seam between the app and its data source.
 *
 * Every page and component reads places through this interface, never from JSON
 * directly. Moving to a .NET API + PostgreSQL later means adding an
 * `HttpPlaceRepository` and changing `getPlaceRepository()` — nothing else.
 *
 * Methods are async even though the static implementation is synchronous, so the
 * call sites are already shaped for a network-backed implementation.
 */
export interface PlaceRepository {
  getCity(cityId: string): Promise<City | null>;
  listCities(): Promise<City[]>;
  /** Active places only. Hidden and permanently closed places never enter recommendations. */
  listPlaces(filter?: PlaceFilter): Promise<Place[]>;
  /** Includes non-active places, so a shared URL to a closed place still resolves. */
  getPlaceBySlug(slug: string): Promise<Place | null>;
  getDistrict(cityId: string, districtId: string): Promise<District | null>;
}

export type PlaceFilter = {
  readonly cityId?: string;
  readonly categories?: readonly Category[];
  readonly districtId?: string;
};
