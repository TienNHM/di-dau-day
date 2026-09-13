import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR, CITY_BOXES } from './config';
import type { CachedPlace } from './config';
import type { Category, Tag } from '../../src/lib/places/types';

/**
 * Turns the Overture snapshot into seed files under `data/places/imported/`.
 *
 *   pnpm data:import          # dry run
 *   pnpm data:import --write
 *
 * Imported places are kept in their own directory, separate from the hand-curated
 * ones. Provenance matters: these can be regenerated wholesale from a newer Overture
 * release, while the curated files contain human judgement that must never be
 * overwritten by a script.
 *
 * Three fields are deliberately left empty — priceRange, goodFor and editorialNote.
 * No open dataset has them, and inventing them would be fabrication. The scorer
 * treats the first two as unknown (half credit) and the UI says so rather than
 * guessing.
 */

/** Below this, Overture records are mostly stale or duplicated listings. */
const MIN_CONFIDENCE = 0.75;

/**
 * Cap per district per category rather than per city.
 *
 * A plain city-wide top-N concentrates everything downtown, which makes the wizard
 * useless for anyone who picks a suburban district. Spreading the quota guarantees
 * every district that appears in the picker can actually answer every intent.
 */
const MIN_PER_DISTRICT_PER_CATEGORY = 10;
const MAX_PER_DISTRICT_PER_CATEGORY = 60;

/**
 * Rough floor for how many places a city should end up with.
 *
 * Without this the quota starves cities that are not subdivided into districts:
 * Nha Trang and Vũng Tàu appear as a single district, so a flat per-district quota
 * gave them ~55 places against TP.HCM's 1,133 — a wizard that runs out of answers
 * after three spins. The quota therefore scales inversely with how finely a city is
 * divided.
 */
/*
 * Raised from 280 now that gyms and schools no longer consume 16% of the budget, and
 * because the point of this revision is more places worth visiting. Deliberately
 * modest: the site publishes one page and one share image per place, and the whole
 * build has to stay inside GitHub Pages' 1 GB.
 */
const TARGET_PER_CITY = 380;
/** food, cafe, entertainment, outdoor, family, shopping, activity. */
const CATEGORY_COUNT = 7;

function quotaFor(districtCount: number): number {
  const needed = Math.ceil(TARGET_PER_CITY / Math.max(1, districtCount * CATEGORY_COUNT));
  return Math.max(MIN_PER_DISTRICT_PER_CATEGORY, Math.min(MAX_PER_DISTRICT_PER_CATEGORY, needed));
}

/**
 * A chain must not dominate the reel.
 *
 * Highlands Coffee has dozens of branches in one city; without a cap the spin would
 * return it again and again and the result would stop feeling like a discovery.
 */
const MAX_PER_BRAND_PER_CITY = 2;

/** The few tags that follow from an Overture category without guessing. */
const CATEGORY_TAGS: Partial<Record<Category, readonly Tag[]>> = {
  outdoor: ['ngoai-troi'],
  cafe: [],
  food: [],
  entertainment: ['trong-nha'],
  family: ['tre-em'],
  activity: [],
};

const SUBCATEGORY_TAGS: readonly { readonly test: RegExp; readonly tags: readonly Tag[] }[] = [
  { test: /^(park|garden|botanical_garden)$/, tags: ['cay-xanh', 'ngoai-troi'] },
  { test: /^beach$/, tags: ['ngoai-troi', 'view-dep'] },
  { test: /^(museum|art_gallery)$/, tags: ['nghe-thuat', 'trong-nha'] },
  { test: /^(landmark_and_historical_building|monument|historic_site)$/, tags: ['lich-su', 'chup-anh'] },
  { test: /^(buddhist_temple|pagoda|shrine|church_cathedral)$/, tags: ['lich-su', 'yen-tinh'] },
  { test: /^(bar|pub|cocktail_bar|night_club|beer_garden)$/, tags: ['mo-khuya'] },
  { test: /^(cinema|karaoke|bowling|arcade|pool_billiards)$/, tags: ['trong-nha', 'may-lanh'] },
  { test: /^(performing_arts_theater|performing_arts|theatre|theater|opera_house|concert_hall|amphitheater|cultural_center)$/, tags: ['nghe-thuat', 'trong-nha'] },
  { test: /^(climbing|cooking_school|pottery_studio)$/, tags: ['van-dong'] },
  { test: /^(coffee_shop|cafe|tea_room)$/, tags: ['chill'] },
  { test: /^(waterfall|lake|national_park|nature_preserve|hiking_trail|island|viewpoint|observation_deck|scenic_lookout)$/, tags: ['ngoai-troi', 'view-dep'] },
  { test: /^(night_market|market|farmers_market|flea_market)$/, tags: ['ngoai-troi', 'mo-khuya'] },
  { test: /^(bookstore|library)$/, tags: ['yen-tinh', 'trong-nha'] },
];

/**
 * A finer bucket than `Category`, used only to balance what gets picked.
 *
 * The previous quota was per district per category, and within a category the list
 * was simply sorted by confidence. In `outdoor` that meant 2,664 temples and 6,240
 * landmarks filled every district's allowance before the 142 museums were reached —
 * 20 museums survived nationwide against 220 temples. The category was doing its job;
 * it was just too coarse to notice.
 */
const GROUP_RULES: readonly { readonly test: RegExp; readonly group: string }[] = [
  { test: /^(museum|art_gallery)$|_museum$/, group: 'culture' },
  { test: /^(landmark_and_historical_building|monument|historic_site|castle|palace|fort|tourist_attraction|tourist_information_center)$/, group: 'heritage' },
  { test: /^(buddhist_temple|church_cathedral|pagoda|shrine)$/, group: 'worship' },
  { test: /^(park|garden|botanical_garden|beach|lake|hiking_trail|scenic_lookout|national_park|nature_preserve|waterfall|cave|island|hot_spring|viewpoint|observation_deck)$/, group: 'nature' },

  { test: /^(cinema|movie_theater)$/, group: 'screen' },
  { test: /^(performing_arts_theater|performing_arts|theatre|theater|opera_house|concert_hall|amphitheater|cultural_center|music_venue|comedy_club)$/, group: 'stage' },
  { test: /^(karaoke|pool_billiards|bowling|arcade|escape_game)$/, group: 'games' },
  { test: /(^|_)(bar|pub|night_club|brewery)$/, group: 'nightlife' },

  { test: /^(amusement_park|water_park|theme_park|playground)$/, group: 'funfair' },
  { test: /^(zoo|aquarium|petting_zoo|planetarium)$/, group: 'animals' },

  { test: /^(night_market|market|farmers_market|flea_market)$/, group: 'market' },
  { test: /^(shopping_center)$/, group: 'mall' },
  { test: /^(bookstore|library)$/, group: 'books' },

  { test: /^(coffee_shop|cafe|internet_cafe)$/, group: 'coffee' },
  { test: /^(tea_room|bubble_tea)$/, group: 'tea' },
  { test: /^(ice_cream_shop|dessert_shop|smoothie_juice_bar|juice_bar|bakery)$/, group: 'sweet' },

  { test: /^(vietnamese_restaurant|noodles_restaurant|noodles|street_food|street_vendor)$/, group: 'viet' },
  { test: /^(seafood_restaurant)$/, group: 'seafood' },
  { test: /^(barbecue_restaurant|barbecue|hot_pot)$/, group: 'grill' },
  { test: /^(korean|japanese|sushi|chinese|thai|asian|indian|vietnamese)_restaurant$/, group: 'asian' },
  { test: /^(pizza|italian|french|american|mexican|steak|burger|fast_food)_restaurant$|^(fast_food_restaurant)$/, group: 'western' },
  { test: /^(vegetarian|vegan)_restaurant$/, group: 'veg' },
];

/**
 * How many places a group takes per round of the interleave.
 *
 * Round-robin alone gave every group an equal share, which sounds fair and is not:
 * it left KFC and Pizza Hut occupying the same amount of a district's food budget as
 * every Vietnamese restaurant combined. Nine of the most ordinary dishes here — bún
 * bò, cơm tấm, bánh mì, bánh xèo, hủ tiếu — could not muster three places nationwide,
 * while there were 82 fried-chicken outlets.
 *
 * A weight above one is a statement that this group is worth more of the budget to
 * someone deciding where to go in a Vietnamese city. Groups not listed take one.
 */
const GROUP_WEIGHTS: Readonly<Record<string, number>> = {
  // The reason the product exists. Their names are also what the dish catalogue
  // matches on, so supply here is what makes "hôm nay ăn gì" answerable at all.
  viet: 5,
  seafood: 2,
  grill: 2,
  // Café culture is not a niche here.
  coffee: 2,
  tea: 2,
  // Scarce and exactly what was missing: somewhere to spend an afternoon.
  culture: 3,
  nature: 3,
  stage: 3,
  screen: 2,
  market: 2,
};

/** Falls back to the category itself, so a new Overture type is merely unbalanced, not dropped. */
function groupFor(overtureCategory: string | null, category: Category): string {
  if (overtureCategory) {
    const rule = GROUP_RULES.find((candidate) => candidate.test.test(overtureCategory));
    if (rule) return rule.group;
  }
  return `${category}-other`;
}

function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function districtIdFor(locality: string | null): string | null {
  if (!locality) return null;
  const name = locality.trim().replace(/\s+/g, ' ');
  if (/^(phường|phuong|xã|xa|ấp|ap)\b/i.test(name)) return null;

  const numbered = /^quận\s+(\d+)$/i.exec(name);
  if (numbered) return `quan-${numbered[1]}`;

  const named = /^(?:quận|huyện|thị xã|thành phố|tp\.?)\s+(.+)$/i.exec(name);
  return toSlug(named?.[1] ?? name);
}

/**
 * Editorial popularity has no equivalent in the data, so this is a deliberate proxy
 * for "worth suggesting": how sure Overture is the record is real, plus whether the
 * business bothers to maintain a public presence.
 *
 * Tuned to land in the same 40–85 band the hand-curated places occupy, so imported
 * and curated places compete on comparable terms rather than one class always
 * winning.
 */
function popularityFor(place: CachedPlace): number {
  const fromConfidence = (place.confidence - MIN_CONFIDENCE) / (1 - MIN_CONFIDENCE); // 0–1
  const score = 40 + fromConfidence * 30 + (place.website ? 10 : 0) + (place.phone ? 5 : 0);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function tagsFor(place: CachedPlace, category: Category): Tag[] {
  const fromSub = SUBCATEGORY_TAGS.find((rule) => place.category && rule.test.test(place.category));
  return [...new Set([...(CATEGORY_TAGS[category] ?? []), ...(fromSub?.tags ?? [])])];
}

/**
 * Folds decorative Unicode back to ordinary letters.
 *
 * Listings copied from social media often use the mathematical alphanumeric block:
 * "𝟐𝟒𝐡 𝐅𝐨𝐨𝐝 - Đ𝗶𝗲̣̂𝗻 𝗻𝗴𝗼̣𝗰". Those code points survive the slug's accent-stripping as
 * nothing at all, so that place got the slug "d" and failed validation. NFKC maps
 * them to "24h Food - Điện ngọc", which both fixes the slug and is what the name was
 * always meant to read as.
 */
function tidyName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Junk names that are addresses, phone numbers or placeholders rather than places. */
function isUsableName(name: string): boolean {
  if (name.length < 2 || name.length > 80) return false;
  if (/^[\d\s\-+().]+$/.test(name)) return false;
  if (/^(test|n\/a|unknown|null)$/i.test(name.trim())) return false;
  return true;
}

type Imported = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  subCategory?: string;
  tags: Tag[];
  location: { cityId: string; districtId: string; address: string; lat: number; lng: number };
  images: never[];
  popularity: number;
  source: 'overture';
  sourceId: string;
  status: 'active';
  updatedAt: string;
};

async function importCity(cityId: string, validDistricts: Set<string>, takenSlugs: Set<string>) {
  const perDistrictPerCategory = quotaFor(validDistricts.size);
  let places: CachedPlace[];
  try {
    const raw = JSON.parse(await readFile(join(CACHE_DIR, `${cityId}.json`), 'utf8')) as {
      places: CachedPlace[];
    };
    places = raw.places;
  } catch {
    return { cityId, imported: [] as Imported[], reason: 'chưa có snapshot' };
  }

  const eligible = places
    .filter((place) => place.confidence >= MIN_CONFIDENCE)
    .filter((place) => place.ourCategory !== null)
    .filter((place) => isUsableName(tidyName(place.name)))
    // An address is what makes a suggestion actionable; without one the directions
    // button is the only thing left and there is nothing to show on the card.
    .filter((place) => place.address !== null && place.address.trim().length >= 4)
    .filter((place) => {
      const district = districtIdFor(place.locality);
      return district !== null && validDistricts.has(district);
    })
    .sort((a, b) => b.confidence - a.confidence);

  /*
   * Round-robin across groups instead of straight down the confidence list.
   *
   * The budget per district and category is unchanged; what changes is who gets to
   * spend it. Taking one place from each group in turn means the scarce groups —
   * museums, cinemas, theatres — are served before the abundant ones exhaust the
   * allowance, without needing a hand-tuned quota for each.
   */
  const buckets = new Map<string, CachedPlace[]>();
  for (const place of eligible) {
    const districtId = districtIdFor(place.locality)!;
    const key = `${districtId}:${place.ourCategory!}:${groupFor(place.category, place.ourCategory!)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(place);
    else buckets.set(key, [place]);
  }

  type WeightedGroup = { places: CachedPlace[]; weight: number };
  const byDistrictCategory = new Map<string, WeightedGroup[]>();
  for (const [key, bucket] of buckets) {
    const districtCategory = key.slice(0, key.lastIndexOf(':'));
    const group = key.slice(key.lastIndexOf(':') + 1);
    const entry: WeightedGroup = { places: bucket, weight: GROUP_WEIGHTS[group] ?? 1 };

    const groups = byDistrictCategory.get(districtCategory);
    if (groups) groups.push(entry);
    else byDistrictCategory.set(districtCategory, [entry]);
  }

  const interleaved: CachedPlace[] = [];
  for (const groups of byDistrictCategory.values()) {
    // Scarcest group first at each round, so a district with one museum keeps it.
    groups.sort((a, b) => a.places.length - b.places.length);

    const taken = new Map<CachedPlace[], number>();
    let remaining = groups.reduce((sum, group) => sum + group.places.length, 0);

    while (remaining > 0) {
      let progressed = false;

      for (const group of groups) {
        const from = taken.get(group.places) ?? 0;
        // A weighted group takes several places before the next group gets a turn.
        const slice = group.places.slice(from, from + group.weight);
        if (slice.length === 0) continue;

        interleaved.push(...slice);
        taken.set(group.places, from + slice.length);
        remaining -= slice.length;
        progressed = true;
      }

      // Nothing left anywhere; guards against an infinite loop if a group is empty.
      if (!progressed) break;
    }
  }

  const quota = new Map<string, number>();
  const brandCount = new Map<string, number>();
  const seenPosition = new Set<string>();
  const imported: Imported[] = [];

  for (const place of interleaved) {
    const category = place.ourCategory!;
    const districtId = districtIdFor(place.locality)!;

    const quotaKey = `${districtId}:${category}`;
    if ((quota.get(quotaKey) ?? 0) >= perDistrictPerCategory) continue;

    if (place.brand) {
      if ((brandCount.get(place.brand) ?? 0) >= MAX_PER_BRAND_PER_CITY) continue;
    }

    // Overture occasionally lists the same shop twice at near-identical coordinates.
    const positionKey = `${place.lat.toFixed(4)},${place.lng.toFixed(4)}`;
    if (seenPosition.has(positionKey)) continue;

    const name = tidyName(place.name);
    let slug = toSlug(name);
    // Two characters is what the schema requires; a name made entirely of symbols
    // cannot produce one and is not a place anybody searched for.
    if (slug.length < 2) continue;
    if (takenSlugs.has(slug)) slug = `${slug}-${districtId}`;
    if (takenSlugs.has(slug)) {
      let suffix = 2;
      while (takenSlugs.has(`${slug}-${suffix}`)) suffix += 1;
      slug = `${slug}-${suffix}`;
    }

    takenSlugs.add(slug);
    seenPosition.add(positionKey);
    quota.set(quotaKey, (quota.get(quotaKey) ?? 0) + 1);
    if (place.brand) brandCount.set(place.brand, (brandCount.get(place.brand) ?? 0) + 1);

    imported.push({
      id: `ovt-${place.id.slice(0, 16)}`,
      slug,
      name,
      category,
      ...(place.category ? { subCategory: toSlug(place.category) } : {}),
      tags: tagsFor(place, category),
      location: {
        cityId,
        districtId,
        address: place.address!,
        lat: place.lat,
        lng: place.lng,
      },
      images: [],
      popularity: popularityFor(place),
      source: 'overture',
      sourceId: place.id,
      status: 'active',
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  return { cityId, imported, reason: null, perDistrictPerCategory };
}

async function main() {
  const write = process.argv.includes('--write');

  // Slugs are globally unique so that /dia-diem/[slug] stays short. Existing
  // curated slugs are reserved first, so an import can never steal a live URL.
  const takenSlugs = new Set<string>();
  for (const file of ['food', 'cafe', 'entertainment', 'outdoor', 'dating', 'family', 'activity']) {
    const existing = JSON.parse(await readFile(join('data', 'places', `${file}.json`), 'utf8')) as {
      slug: string;
    }[];
    for (const place of existing) takenSlugs.add(place.slug);
  }

  await mkdir(join('data', 'places', 'imported'), { recursive: true });

  let total = 0;
  for (const city of CITY_BOXES) {
    const cityFile = JSON.parse(await readFile(join('data', 'cities', `${city.id}.json`), 'utf8')) as {
      districts: { id: string }[];
    };
    const validDistricts = new Set(cityFile.districts.map((d) => d.id));

    const { imported, reason, perDistrictPerCategory } = await importCity(
      city.id,
      validDistricts,
      takenSlugs,
    );
    if (reason) {
      console.log(`  ${city.name.padEnd(18)} — ${reason}`);
      continue;
    }

    total += imported.length;
    console.log(
      `  ${city.name.padEnd(18)} ${String(imported.length).padStart(5)} địa điểm` +
        `  (${validDistricts.size} quận, tối đa ${perDistrictPerCategory}/quận/nhóm)`,
    );

    if (write) {
      await writeFile(
        join('data', 'places', 'imported', `${city.id}.json`),
        `${JSON.stringify(imported, null, 2)}\n`,
      );
    }
  }

  console.log(`\n[import] Tổng ${total} địa điểm ${write ? 'đã ghi' : 'sẽ ghi'}.`);
  if (!write) console.log('[import] Đây là chạy thử. Thêm --write để ghi vào file.');
}

main().catch((error: unknown) => {
  console.error('[import] Lỗi:', error);
  process.exit(1);
});
