import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import {
  CACHE_DIR,
  CATEGORY_SQL_FILTER,
  CITY_BOXES,
  MIN_CONFIDENCE,
  OVERTURE_PLACES_SOURCE,
  OVERTURE_RELEASE,
  getCityBox,
  mapCategory,
} from './config';
import type { CachedPlace, CityBox } from './config';

/**
 * Downloads an Overture Places snapshot per city into `.cache/overture/`.
 *
 * This is the only slow, network-bound step: it scans Parquet on S3 and takes a
 * minute or two per city. Everything downstream (verify, import) reads the cache,
 * so the expensive query runs once rather than on every experiment.
 *
 *   pnpm data:fetch              # every city
 *   pnpm data:fetch ho-chi-minh  # one city
 */

async function fetchCity(db: Awaited<ReturnType<DuckDBInstance['connect']>>, city: CityBox) {
  const sql = `
    SELECT
      id,
      names.primary            AS name,
      categories.primary       AS category,
      confidence,
      addresses[1].freeform    AS address,
      addresses[1].locality    AS locality,
      ROUND(bbox.ymin, 6)      AS lat,
      ROUND(bbox.xmin, 6)      AS lng,
      websites[1]              AS website,
      phones[1]                AS phone,
      brand.names.primary      AS brand,
      sources[1].license       AS license,
      sources[1].dataset       AS dataset
    FROM read_parquet('${OVERTURE_PLACES_SOURCE}')
    WHERE bbox.xmin BETWEEN ${city.minLng} AND ${city.maxLng}
      AND bbox.ymin BETWEEN ${city.minLat} AND ${city.maxLat}
      AND confidence >= ${MIN_CONFIDENCE}
      AND names.primary IS NOT NULL
      AND ${CATEGORY_SQL_FILTER}
  `;

  const started = Date.now();
  const result = await db.runAndReadAll(sql);

  const places: CachedPlace[] = result.getRowObjects().map((row) => ({
    id: String(row.id),
    name: String(row.name),
    category: row.category === null ? null : String(row.category),
    ourCategory: mapCategory(row.category === null ? null : String(row.category)),
    confidence: Number(row.confidence),
    address: row.address === null ? null : String(row.address),
    locality: row.locality === null ? null : String(row.locality),
    lat: Number(row.lat),
    lng: Number(row.lng),
    website: row.website === null ? null : String(row.website),
    phone: row.phone === null ? null : String(row.phone),
    brand: row.brand === null ? null : String(row.brand),
    license: row.license === null ? null : String(row.license),
    dataset: row.dataset === null ? null : String(row.dataset),
  }));

  const path = join(CACHE_DIR, `${city.id}.json`);
  await writeFile(
    path,
    JSON.stringify({ release: OVERTURE_RELEASE, city: city.id, fetchedAt: new Date().toISOString(), places }),
  );

  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const mapped = places.filter((p) => p.ourCategory !== null).length;
  console.log(
    `  ${city.name.padEnd(18)} ${String(places.length).padStart(7)} POI` +
      ` · ${String(mapped).padStart(7)} khớp category` +
      ` · ${seconds}s → ${path}`,
  );
}

async function main() {
  const requested = process.argv.slice(2);
  const cities = requested.length > 0
    ? requested.map((id) => {
        const city = getCityBox(id);
        if (!city) throw new Error(`Không biết thành phố "${id}". Có: ${CITY_BOXES.map((c) => c.id).join(', ')}`);
        return city;
      })
    : CITY_BOXES;

  await mkdir(CACHE_DIR, { recursive: true });

  const instance = await DuckDBInstance.create(':memory:');
  const db = await instance.connect();
  await db.run("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';");

  console.log(`[overture] release ${OVERTURE_RELEASE}, confidence >= ${MIN_CONFIDENCE}\n`);
  for (const city of cities) {
    await fetchCity(db, city);
  }
  console.log('\n[overture] Xong. Chạy `pnpm data:verify` để đối chiếu dữ liệu hiện có.');
}

main().catch((error: unknown) => {
  console.error('[overture] Lỗi khi tải dữ liệu:', error);
  process.exit(1);
});
