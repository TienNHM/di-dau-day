import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR, CITY_BOXES } from './config';
import type { CachedPlace } from './config';
import { getPlaceRepository } from '../../src/lib/places/static-repository';
import { haversineKm } from '../../src/lib/geo/haversine';
import type { Place } from '../../src/lib/places/types';

/**
 * Cross-checks hand-curated places against the Overture snapshot.
 *
 * The seed data was written from knowledge, not from survey, so its coordinates are
 * estimates. A wrong coordinate is the worst failure this product has: the user taps
 * "Xem đường đi" and drives to the wrong place. This is the cheapest way to find
 * those before a user does.
 *
 *   pnpm data:fetch ho-chi-minh   # once
 *   pnpm data:verify
 */

/** Anything beyond this is treated as a different location, not a rounding error. */
const SUSPICIOUS_METRES = 200;
/** Search radius when looking for the same place near our coordinate. */
const NEARBY_KM = 1.5;
const NAME_MATCH_THRESHOLD = 0.55;

/**
 * Vietnamese-aware normalisation.
 *
 * Strips diacritics so "Cà Phê" and "ca phe" compare equal, and drops the generic
 * leading nouns ("quán", "nhà hàng", "khu du lịch") that appear in our names but
 * often not in Overture's, and vice versa.
 */
function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\b(quan|nha hang|ca phe|cafe|khu du lich|cong vien|bao tang|pho|tiem|shop|the)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Token-overlap similarity, biased toward containment.
 *
 * Chosen over edit distance because the usual mismatch here is extra words
 * ("Phở Lệ" vs "Phở Lệ Nguyễn Trãi"), which containment handles and Levenshtein
 * punishes heavily.
 */
function similarity(a: string, b: string): number {
  const left = new Set(normalise(a).split(' ').filter(Boolean));
  const right = new Set(normalise(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;

  return shared / Math.min(left.size, right.size);
}

type Finding = {
  readonly slug: string;
  readonly name: string;
  readonly verdict: 'ok' | 'lech' | 'khong-thay' | 'trung-ten-xa';
  readonly metres?: number;
  readonly suggestion?: { name: string; lat: number; lng: number; address: string | null; locality: string | null };
};

function inspect(place: Place, cached: readonly CachedPlace[]): Finding {
  const ours = { lat: place.location.lat, lng: place.location.lng };

  const nearby = cached
    .map((candidate) => ({
      candidate,
      km: haversineKm(ours, { lat: candidate.lat, lng: candidate.lng }),
      score: similarity(place.name, candidate.name),
    }))
    .filter((row) => row.km <= NEARBY_KM && row.score >= NAME_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.km - b.km);

  const best = nearby[0];
  if (best) {
    const metres = Math.round(best.km * 1000);
    if (metres <= SUSPICIOUS_METRES) {
      return { slug: place.slug, name: place.name, verdict: 'ok', metres };
    }
    return {
      slug: place.slug,
      name: place.name,
      verdict: 'lech',
      metres,
      suggestion: {
        name: best.candidate.name,
        lat: best.candidate.lat,
        lng: best.candidate.lng,
        address: best.candidate.address,
        locality: best.candidate.locality,
      },
    };
  }

  // Not near our coordinate — is it anywhere else in the city? If so, our coordinate
  // is probably wrong rather than the place being absent.
  const anywhere = cached
    .map((candidate) => ({ candidate, score: similarity(place.name, candidate.name) }))
    .filter((row) => row.score >= 0.7)
    .sort((a, b) => b.score - a.score)[0];

  if (anywhere) {
    const km = haversineKm(ours, { lat: anywhere.candidate.lat, lng: anywhere.candidate.lng });
    return {
      slug: place.slug,
      name: place.name,
      verdict: 'trung-ten-xa',
      metres: Math.round(km * 1000),
      suggestion: {
        name: anywhere.candidate.name,
        lat: anywhere.candidate.lat,
        lng: anywhere.candidate.lng,
        address: anywhere.candidate.address,
        locality: anywhere.candidate.locality,
      },
    };
  }

  return { slug: place.slug, name: place.name, verdict: 'khong-thay' };
}

async function main() {
  const cityId = process.argv[2] ?? 'ho-chi-minh';
  const city = CITY_BOXES.find((c) => c.id === cityId);
  if (!city) throw new Error(`Không biết thành phố "${cityId}"`);

  const cachePath = join(CACHE_DIR, `${cityId}.json`);
  let cached: readonly CachedPlace[];
  try {
    const raw = JSON.parse(await readFile(cachePath, 'utf8')) as { places: CachedPlace[] };
    cached = raw.places;
  } catch {
    throw new Error(`Chưa có snapshot. Chạy: pnpm data:fetch ${cityId}`);
  }

  const places = await getPlaceRepository().listPlaces();
  const findings = places.map((place) => inspect(place, cached));

  const by = (verdict: Finding['verdict']) => findings.filter((f) => f.verdict === verdict);

  console.log(`[verify] ${places.length} địa điểm, đối chiếu với ${cached.length} POI Overture (${city.name})\n`);
  console.log(`  ✅ khớp, lệch ≤ ${SUSPICIOUS_METRES}m : ${by('ok').length}`);
  console.log(`  ⚠️  khớp tên nhưng lệch xa     : ${by('lech').length}`);
  console.log(`  ❓ tìm thấy tên ở chỗ khác     : ${by('trung-ten-xa').length}`);
  console.log(`  ⬜ Overture không có            : ${by('khong-thay').length}\n`);

  for (const finding of [...by('lech'), ...by('trung-ten-xa')]) {
    const icon = finding.verdict === 'lech' ? '⚠️ ' : '❓';
    console.log(`${icon} ${finding.name}  (lệch ${finding.metres}m)`);
    console.log(`    ta   : ${finding.slug}`);
    if (finding.suggestion) {
      console.log(`    họ   : ${finding.suggestion.name}`);
      console.log(`    toạ độ đề xuất: ${finding.suggestion.lat}, ${finding.suggestion.lng}`);
      if (finding.suggestion.address) {
        console.log(`    địa chỉ họ ghi: ${finding.suggestion.address}${finding.suggestion.locality ? `, ${finding.suggestion.locality}` : ''}`);
      }
    }
    console.log('');
  }

  const reportPath = join(CACHE_DIR, `verify-${cityId}.json`);
  await writeFile(reportPath, JSON.stringify(findings, null, 2));
  console.log(`[verify] Báo cáo đầy đủ: ${reportPath}`);

  if (by('khong-thay').length > 0) {
    console.log(
      `\n[verify] ${by('khong-thay').length} chỗ Overture không có. Không có nghĩa là sai —` +
        ` quán vỉa hè và địa danh thường thiếu trong mọi nguồn mở. Phải kiểm tra tay:`,
    );
    for (const finding of by('khong-thay')) console.log(`    - ${finding.name}`);
  }
}

main().catch((error: unknown) => {
  console.error('[verify] Lỗi:', error);
  process.exit(1);
});
