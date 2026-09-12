import { DuckDBInstance } from '@duckdb/node-api';
import { OVERTURE_PLACES_SOURCE, getCityBox } from './config';

/**
 * Prints Overture category names matching a pattern, with counts, for one city box.
 *
 *   pnpm data:taxonomy mall attraction shopping
 *
 * Exists because guessing category names does not work: of 37 names added by hand in
 * one revision, 20 returned nothing — `performing_arts_theater` and `tourist_attraction`
 * are not in the taxonomy, while `theatre` and `cultural_center` are. A name that does
 * not exist fails silently, so this makes the vocabulary checkable before use.
 */
async function main() {
  const patterns = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (patterns.length === 0) {
    console.error('Cách dùng: pnpm data:taxonomy <từ khoá> [từ khoá...]');
    process.exit(1);
  }

  const box = getCityBox('ho-chi-minh');
  if (!box) throw new Error('Không tìm thấy khung toạ độ TP.HCM');

  const instance = await DuckDBInstance.create(':memory:');
  const db = await instance.connect();
  await db.run("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';");

  const where = patterns
    .map((pattern) => `categories.primary ILIKE '%${pattern.replace(/'/g, "''")}%'`)
    .join(' OR ');

  const result = await db.runAndReadAll(`
    SELECT categories.primary AS category, COUNT(*) AS n
    FROM read_parquet('${OVERTURE_PLACES_SOURCE}')
    WHERE bbox.xmin BETWEEN ${box.minLng} AND ${box.maxLng}
      AND bbox.ymin BETWEEN ${box.minLat} AND ${box.maxLat}
      AND categories.primary IS NOT NULL
      AND (${where})
    GROUP BY 1
    ORDER BY n DESC
    LIMIT 40
  `);

  for (const row of result.getRowObjects()) {
    console.log(String(row.n).padStart(7), row.category);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
