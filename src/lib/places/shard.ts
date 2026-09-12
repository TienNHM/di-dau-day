import type { District, PlaceSummary } from './types';

/**
 * One city's data as the browser receives it.
 *
 * Districts travel with the places rather than in a separate request: they are
 * derived from the same data (only districts that have places are listed), and the
 * wizard needs both before it can ask its last question.
 */
export type CityShard = {
  readonly cityId: string;
  /** Content hash. A cached copy is current only while this still matches the manifest. */
  readonly hash: string;
  readonly districts: readonly District[];
  readonly places: readonly PlaceSummary[];
};

/**
 * The fields an itinerary card needs that a `PlaceSummary` deliberately withholds.
 *
 * Kept in a second file rather than folded into the shard because the wizard — the
 * request on the critical path — never reads them, and addresses are a third of the
 * bytes. The itinerary page fetches both, by which time the shard is normally
 * already cached from the wizard the visitor just came through.
 */
export type PlaceExtra = {
  readonly slug: string;
  readonly address: string;
  readonly note?: string;
  /** Carried so directions cannot land on the wrong branch of a chain. */
  readonly mapsPlaceId?: string;
};

export type CityCards = {
  readonly cityId: string;
  readonly hash: string;
  readonly extras: readonly PlaceExtra[];
};

export type ShardEntry = {
  readonly hash: string;
  readonly cardsHash: string;
  readonly placeCount: number;
};

export type ShardManifest = Readonly<Record<string, ShardEntry>>;

/** Where a city's shard is served from, relative to the site root. */
export function shardPath(cityId: string): string {
  return `/data/places/${cityId}.json`;
}

export function cardsPath(cityId: string): string {
  return `/data/places/${cityId}.cards.json`;
}
