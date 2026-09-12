import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OG_EXTENSION, renderBrandOgImage, renderPlaceOgImage, toJpeg } from '../src/lib/og/render';
import { getPlaceRepository } from '../src/lib/places/static-repository';
import { DEFAULT_CITY_ID } from '../src/lib/site';

/**
 * Renders every place's share image to `public/og/<slug>.png` before the build.
 *
 * Next's own `opengraph-image` convention emits an extensionless file. GitHub Pages
 * picks Content-Type from the file extension, so that file would be served as
 * application/octet-stream and every Facebook and Zalo crawler would refuse it —
 * breaking the share preview silently, which is the one feature the product's growth
 * depends on. Emitting real `.png` files avoids the problem entirely.
 *
 * Output is generated, not committed: `public/og/` is gitignored and rebuilt here.
 */
async function main() {
  const outDir = join(process.cwd(), 'public', 'og');
  await mkdir(outDir, { recursive: true });

  const repo = getPlaceRepository();
  const places = await repo.listPlaces();

  let written = 0;
  for (const place of places) {
    const district = await repo.getDistrict(DEFAULT_CITY_ID, place.location.districtId);
    const buffer = await toJpeg(await renderPlaceOgImage(place, district));
    await writeFile(join(outDir, `${place.slug}.${OG_EXTENSION}`), buffer);
    written += 1;
  }

  await writeFile(join(outDir, `home.${OG_EXTENSION}`), await toJpeg(await renderBrandOgImage()));

  console.log(`[og] Đã tạo ${written} ảnh địa điểm + 1 ảnh trang chủ trong public/og/`);
}

main().catch((error: unknown) => {
  console.error('[og] Không tạo được ảnh share:', error);
  process.exit(1);
});
