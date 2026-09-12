import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR, CITY_BOXES } from './config';
import type { CachedPlace, CityBox } from './config';

/**
 * Generates `data/cities/*.json` from the Overture snapshot.
 *
 * District lists are derived from the data rather than typed by hand, for two
 * reasons: hand-typing 9 cities' districts invites errors nobody would notice, and
 * a district that exists administratively but holds no places in our catalogue is a
 * dead end in the wizard. Deriving them guarantees every district offered can
 * actually answer.
 *
 * Centroids are the mean of the district's places — close enough for the distance
 * scoring, which only ever ranks "nearby" against "across town".
 *
 *   pnpm data:cities
 */

/** Below this a "district" is usually a mis-parsed address rather than a real area. */
const MIN_PLACES_PER_DISTRICT = 25;

/** Short labels for the city picker, where the full name is too long. */
const CITY_SHORT_NAMES: Record<string, string> = {
  'ho-chi-minh': 'TP.HCM',
  'ha-noi': 'Hà Nội',
  'da-nang': 'Đà Nẵng',
  'da-lat': 'Đà Lạt',
  'nha-trang': 'Nha Trang',
  'can-tho': 'Cần Thơ',
  hue: 'Huế',
  'hai-phong': 'Hải Phòng',
  'vung-tau': 'Vũng Tàu',
};

const CITY_SLUGS: Record<string, string> = {
  'ho-chi-minh': 'tp-ho-chi-minh',
  'ha-noi': 'ha-noi',
  'da-nang': 'da-nang',
  'da-lat': 'da-lat',
  'nha-trang': 'nha-trang',
  'can-tho': 'can-tho',
  hue: 'hue',
  'hai-phong': 'hai-phong',
  'vung-tau': 'vung-tau',
};

function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Overture writes localities inconsistently — "Quận 1", "Quận Bình Thạnh",
 * "Thủ Đức", "Phường 12". This normalises them to the way people actually speak,
 * which is what belongs on a result card.
 */
function cleanDistrictName(raw: string): { id: string; name: string; shortName: string } | null {
  const name = raw.trim().replace(/\s+/g, ' ');

  // A ward is finer-grained than this product needs and would fragment the list.
  if (/^(phường|phuong|xã|xa|ấp|ap)\b/i.test(name)) return null;

  const numbered = /^quận\s+(\d+)$/i.exec(name);
  if (numbered) {
    return { id: `quan-${numbered[1]}`, name: `Quận ${numbered[1]}`, shortName: `Quận ${numbered[1]}` };
  }

  const named = /^(?:quận|huyện|thị xã|thành phố|tp\.?)\s+(.+)$/i.exec(name);
  const bare = named?.[1] ?? name;

  return { id: toSlug(bare), name, shortName: bare };
}

async function buildCity(city: CityBox) {
  let places: CachedPlace[];
  try {
    const raw = JSON.parse(await readFile(join(CACHE_DIR, `${city.id}.json`), 'utf8')) as {
      places: CachedPlace[];
    };
    places = raw.places;
  } catch {
    console.log(`  ${city.name.padEnd(18)} — chưa có snapshot, bỏ qua`);
    return null;
  }

  const groups = new Map<string, { name: string; shortName: string; lats: number[]; lngs: number[] }>();

  for (const place of places) {
    if (!place.locality) continue;
    const cleaned = cleanDistrictName(place.locality);
    if (!cleaned) continue;

    const group = groups.get(cleaned.id) ?? {
      name: cleaned.name,
      shortName: cleaned.shortName,
      lats: [],
      lngs: [],
    };
    group.lats.push(place.lat);
    group.lngs.push(place.lng);
    groups.set(cleaned.id, group);
  }

  const mean = (values: number[]) =>
    Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(5));

  const districts = [...groups.entries()]
    .filter(([, group]) => group.lats.length >= MIN_PLACES_PER_DISTRICT)
    .map(([id, group]) => ({
      id,
      name: group.name,
      shortName: group.shortName,
      lat: mean(group.lats),
      lng: mean(group.lngs),
      count: group.lats.length,
    }))
    .sort((a, b) => b.count - a.count);

  if (districts.length === 0) {
    console.log(`  ${city.name.padEnd(18)} — không tách được quận nào, bỏ qua`);
    return null;
  }

  const json = {
    id: city.id,
    name: city.name,
    shortName: CITY_SHORT_NAMES[city.id] ?? city.name,
    slug: CITY_SLUGS[city.id] ?? toSlug(city.name),
    lat: mean(districts.map((d) => d.lat)),
    lng: mean(districts.map((d) => d.lng)),
    districts: districts.map(({ count: _count, ...district }) => district),
  };

  console.log(
    `  ${city.name.padEnd(18)} ${String(districts.length).padStart(3)} quận` +
      `  (${districts.slice(0, 4).map((d) => d.shortName).join(', ')}…)`,
  );

  return json;
}

async function main() {
  console.log('[cities] Tạo danh sách quận từ snapshot Overture\n');

  for (const city of CITY_BOXES) {
    const json = await buildCity(city);
    if (!json) continue;

    // TP.HCM's district list was hand-written and its ids are already live in URLs;
    // regenerating it would break links for no benefit.
    if (city.id === 'ho-chi-minh') {
      console.log('    (giữ nguyên file TP.HCM viết tay — id quận đã nằm trong URL đang chạy)');
      continue;
    }

    await writeFile(join('data', 'cities', `${city.id}.json`), `${JSON.stringify(json, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  console.error('[cities] Lỗi:', error);
  process.exit(1);
});
