import type { Category } from '../../src/lib/places/types';

/**
 * Shared configuration for the Overture Maps data pipeline.
 *
 * Overture Places is CDLA-Permissive-2.0 / Apache-2.0 / CC0 — verified per record
 * for this bounding box. Unlike OpenStreetMap's ODbL there is no share-alike clause,
 * so the resulting catalogue can stay under whatever licence this project chooses.
 * That matters because the data lives in a public repo, which counts as publicly
 * conveying a derivative database.
 *
 * Attribution is still required: see docs/DATA-SOURCES.md.
 */

/** Pin the release so a re-run is reproducible rather than silently drifting. */
export const OVERTURE_RELEASE = '2026-08-19.0';

export const OVERTURE_PLACES_SOURCE = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=places/type=place/*`;

export type CityBox = {
  readonly id: string;
  readonly name: string;
  readonly minLng: number;
  readonly maxLng: number;
  readonly minLat: number;
  readonly maxLat: number;
};

/**
 * Bounding boxes per city. Deliberately generous — a box that clips the edge of a
 * city silently drops whole districts, which is much harder to notice than pulling
 * a few extra places from a neighbouring province.
 */
export const CITY_BOXES: readonly CityBox[] = [
  // Wide enough to reach Củ Chi in the north-west and Cần Giờ in the south-east.
  { id: 'ho-chi-minh', name: 'TP. Hồ Chí Minh', minLng: 106.35, maxLng: 107.05, minLat: 10.35, maxLat: 11.2 },
  { id: 'ha-noi', name: 'Hà Nội', minLng: 105.7, maxLng: 106.0, minLat: 20.9, maxLat: 21.15 },
  { id: 'da-nang', name: 'Đà Nẵng', minLng: 108.1, maxLng: 108.32, minLat: 15.92, maxLat: 16.15 },
  { id: 'da-lat', name: 'Đà Lạt', minLng: 108.38, maxLng: 108.52, minLat: 11.87, maxLat: 12.02 },
  { id: 'nha-trang', name: 'Nha Trang', minLng: 109.13, maxLng: 109.28, minLat: 12.18, maxLat: 12.35 },
  { id: 'can-tho', name: 'Cần Thơ', minLng: 105.66, maxLng: 105.86, minLat: 9.96, maxLat: 10.14 },
  { id: 'hue', name: 'Huế', minLng: 107.5, maxLng: 107.68, minLat: 16.4, maxLat: 16.55 },
  { id: 'hai-phong', name: 'Hải Phòng', minLng: 106.55, maxLng: 106.8, minLat: 20.78, maxLat: 20.93 },
  { id: 'vung-tau', name: 'Vũng Tàu', minLng: 107.02, maxLng: 107.18, minLat: 10.29, maxLat: 10.45 },
];

export function getCityBox(id: string): CityBox | undefined {
  return CITY_BOXES.find((city) => city.id === id);
}

/**
 * Overture category → our category.
 *
 * Built from the taxonomy actually present in Vietnamese cities rather than from
 * the full Overture category list, most of which (real estate agents, hardware
 * shops) has no place in a "where should I go tonight" product.
 *
 * Order matters: the first matching rule wins, so put specific rules before broad ones.
 */
const CATEGORY_RULES: readonly { readonly test: RegExp; readonly category: Category }[] = [
  // Cafés before restaurants: "coffee_shop" would otherwise be caught by nothing,
  // but "internet_cafe" and "cat_cafe" must not fall through to food.
  { test: /^(coffee_shop|cafe|internet_cafe|tea_room|bubble_tea|smoothie_juice_bar)$/, category: 'cafe' },

  { test: /(^|_)(bar|pub|cocktail_bar|beer_garden|night_club|brewery|wine_bar)$/, category: 'entertainment' },
  { test: /^(cinema|movie_theater|karaoke|pool_billiards|bowling|arcade|escape_game|comedy_club|music_venue)$/, category: 'entertainment' },

  { test: /^(amusement_park|water_park|aquarium|zoo|playground|theme_park)$/, category: 'family' },

  { test: /^(park|garden|botanical_garden|beach|hiking_trail|lake|scenic_lookout)$/, category: 'outdoor' },
  { test: /^(landmark_and_historical_building|monument|buddhist_temple|church_cathedral|pagoda|shrine|museum|art_gallery|historic_site)$/, category: 'outdoor' },

  { test: /^(gym|yoga_studio|climbing|martial_arts|dance_school|cooking_school|art_school|pottery)$/, category: 'activity' },

  // Broadest rule last: anything ending in _restaurant, plus the standalone food types.
  { test: /(^|_)restaurant$/, category: 'food' },
  { test: /^(diner|casual_eatery|bakery|food_truck|food|noodles|street_vendor|ice_cream_shop|dessert_shop|bistro|buffet)$/, category: 'food' },
];

export function mapCategory(overtureCategory: string | null): Category | null {
  if (!overtureCategory) return null;
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(overtureCategory)) return rule.category;
  }
  return null;
}

/** SQL fragment listing every Overture category we care about, for server-side filtering. */
export const CATEGORY_SQL_FILTER = `(
  regexp_matches(categories.primary, '(^|_)restaurant$')
  OR categories.primary IN (
    'coffee_shop','cafe','internet_cafe','tea_room','bubble_tea','smoothie_juice_bar',
    'bar','pub','cocktail_bar','beer_garden','night_club','brewery','wine_bar',
    'cinema','movie_theater','karaoke','pool_billiards','bowling','arcade','escape_game','comedy_club','music_venue',
    'amusement_park','water_park','aquarium','zoo','playground','theme_park',
    'park','garden','botanical_garden','beach','hiking_trail','lake','scenic_lookout',
    'landmark_and_historical_building','monument','buddhist_temple','church_cathedral','pagoda','shrine','museum','art_gallery','historic_site',
    'gym','yoga_studio','climbing','martial_arts','dance_school','cooking_school','art_school','pottery',
    'diner','casual_eatery','bakery','food_truck','food','noodles','street_vendor','ice_cream_shop','dessert_shop','bistro','buffet'
  )
)`;

/**
 * Minimum Overture confidence to even cache.
 *
 * Below ~0.5 the records are mostly stale or duplicated listings. Measured for HCMC:
 * 48k food/cafe records total, 34k at >=0.5, 16k at >=0.75, 7k at >=0.9.
 */
export const MIN_CONFIDENCE = 0.5;

/** Where the fetched snapshot lands. Gitignored — regenerate rather than commit. */
export const CACHE_DIR = '.cache/overture';

export type CachedPlace = {
  readonly id: string;
  readonly name: string;
  readonly category: string | null;
  readonly ourCategory: Category | null;
  readonly confidence: number;
  readonly address: string | null;
  readonly locality: string | null;
  readonly lat: number;
  readonly lng: number;
  readonly website: string | null;
  readonly phone: string | null;
  readonly brand: string | null;
  readonly license: string | null;
  readonly dataset: string | null;
};
