import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR } from './config';
import type { CachedPlace } from './config';
import { haversineKm } from '../../src/lib/geo/haversine';

/**
 * Writes verified coordinates back into the seed files.
 *
 *   pnpm data:apply            # dry run — prints what it would change
 *   pnpm data:apply --write    # actually edits data/places/*.json
 *
 * Only coordinates are touched. Names, prices, tags and editorial notes are
 * judgement calls that no dataset can make, and silently overwriting them with a
 * third party's wording would destroy the thing that makes this product worth using.
 */

/** Both the name and the street must agree before a coordinate is trusted. */
const NAME_THRESHOLD = 0.7;
const MAX_KM = 3;

/**
 * The further a coordinate would move, the stronger the corroboration required.
 *
 * A place whose address genuinely matches does not sit two kilometres from where we
 * thought it was — a long jump means the name matched a different business with a
 * coincidentally similar street. The first dry run moved "Chi Cafe" 1.9 km and
 * "Saigon Coffee Roastery" 2.5 km on a bare 0.5 address score; both were wrong.
 * Beyond the last tier nothing is applied automatically, however good the score.
 */
const TIERS: readonly { readonly maxMetres: number; readonly minAddressScore: number }[] = [
  { maxMetres: 300, minAddressScore: 0.5 },
  { maxMetres: 1000, minAddressScore: 0.75 },
];
const NEVER_AUTO_METRES = 1000;

const PLACE_FILES = [
  'food',
  'cafe',
  'entertainment',
  'outdoor',
  'dating',
  'family',
  'activity',
] as const;

function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): Set<string> {
  // Drop street-type words and house numbers: they are noise when comparing
  // "84 Đ. Đặng Văn Ngữ" against "84 Đặng Văn Ngữ, P.10, Phú Nhuận".
  const stop = new Set(['d', 'duong', 'p', 'phuong', 'quan', 'q', 'tp', 'st', 'street']);
  return new Set(
    normalise(value)
      .split(' ')
      .filter((token) => token.length > 1 && !stop.has(token) && !/^\d+$/.test(token)),
  );
}

function overlap(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

type SeedPlace = {
  slug: string;
  name: string;
  location: { address: string; lat: number; lng: number; districtId: string };
  [key: string]: unknown;
};

async function main() {
  const write = process.argv.includes('--write');
  const cityId = 'ho-chi-minh';

  const snapshot = JSON.parse(await readFile(join(CACHE_DIR, `${cityId}.json`), 'utf8')) as {
    places: CachedPlace[];
  };

  let changed = 0;
  let skipped = 0;
  const skippedDetail: string[] = [];

  for (const file of PLACE_FILES) {
    const path = join('data', 'places', `${file}.json`);
    const places = JSON.parse(await readFile(path, 'utf8')) as SeedPlace[];
    let fileChanged = false;

    for (const place of places) {
      const ours = { lat: place.location.lat, lng: place.location.lng };

      const best = snapshot.places
        .map((candidate) => ({
          candidate,
          km: haversineKm(ours, { lat: candidate.lat, lng: candidate.lng }),
          nameScore: overlap(place.name, candidate.name),
          addressScore: candidate.address ? overlap(place.location.address, candidate.address) : 0,
        }))
        .filter((row) => row.km <= MAX_KM && row.nameScore >= NAME_THRESHOLD)
        // Address agreement is the tie-breaker, not distance: a chain has many
        // branches within 3 km and only the street tells them apart.
        .sort((a, b) => b.addressScore - a.addressScore || b.nameScore - a.nameScore)[0];

      if (!best) continue;

      const metres = Math.round(best.km * 1000);
      if (metres < 30) continue;

      const tier = TIERS.find((candidate) => metres <= candidate.maxMetres);

      if (!tier || best.addressScore < tier.minAddressScore) {
        skipped += 1;
        const why =
          metres > NEVER_AUTO_METRES
            ? `lệch ${metres}m — quá xa để tự sửa`
            : `lệch ${metres}m, địa chỉ khớp yếu (${best.addressScore.toFixed(2)})`;
        skippedDetail.push(
          `    ${place.name} — ${why}\n` +
            `      ta: ${place.location.address}\n` +
            `      họ: ${best.candidate.address ?? '(không có)'} → ${best.candidate.lat}, ${best.candidate.lng}`,
        );
        continue;
      }

      console.log(
        `  ${place.name}\n` +
          `      ${place.location.lat}, ${place.location.lng}  →  ${best.candidate.lat}, ${best.candidate.lng}  (lệch ${metres}m)`,
      );
      place.location.lat = best.candidate.lat;
      place.location.lng = best.candidate.lng;
      changed += 1;
      fileChanged = true;
    }

    if (fileChanged && write) {
      await writeFile(path, `${JSON.stringify(places, null, 2)}\n`);
    }
  }

  console.log(`\n[apply] ${changed} toạ độ ${write ? 'đã sửa' : 'sẽ sửa'}.`);

  if (skipped > 0) {
    console.log(
      `\n[apply] ${skipped} chỗ bỏ qua vì địa chỉ không khớp — cần người kiểm tra,` +
        ` rất có thể là nhầm chi nhánh:`,
    );
    console.log(skippedDetail.join('\n'));
  }

  if (!write) console.log('\n[apply] Đây là chạy thử. Thêm --write để ghi vào file.');
}

main().catch((error: unknown) => {
  console.error('[apply] Lỗi:', error);
  process.exit(1);
});
