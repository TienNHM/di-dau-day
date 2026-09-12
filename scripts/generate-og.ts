import { cpus } from 'node:os';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OG_EXTENSION, renderBrandOgImage, renderPlaceOgImage, toJpeg } from '../src/lib/og/render';
import { getPlaceRepository } from '../src/lib/places/static-repository';

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
  /*
   * Cleared, not merged.
   *
   * These files are named by slug, so a re-import that renames or drops places leaves
   * the old images behind — and nothing ever deletes them. One rebalanced import left
   * 6,231 images for 4,183 places: 2,048 orphans, 66 MB, published and served to
   * nobody, growing with every data change against a 1 GB hosting cap.
   */
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const repo = getPlaceRepository();
  const places = await repo.listPlaces();

  /**
   * Rendered in parallel batches rather than one at a time.
   *
   * Both halves of the work release the event loop — resvg rasterises and sharp
   * encodes in native threads — so serialising them left most cores idle. At 4,000+
   * places this is the difference between a build that fits comfortably inside the
   * deploy window and one that does not.
   */
  const CONCURRENCY = Math.max(2, Math.min(8, cpus().length));

  let written = 0;
  for (let start = 0; start < places.length; start += CONCURRENCY) {
    const batch = places.slice(start, start + CONCURRENCY);
    await Promise.all(
      batch.map(async (place) => {
        const district = await repo.getDistrict(place.location.cityId, place.location.districtId);
        const buffer = await toJpeg(await renderPlaceOgImage(place, district));
        await writeFile(join(outDir, `${place.slug}.${OG_EXTENSION}`), buffer);
      }),
    );
    written += batch.length;
  }

  await writeFile(join(outDir, `home.${OG_EXTENSION}`), await toJpeg(await renderBrandOgImage()));

  console.log(`[og] Đã tạo ${written} ảnh địa điểm + 1 ảnh trang chủ trong public/og/`);
}

main().catch((error: unknown) => {
  console.error('[og] Không tạo được ảnh share:', error);
  process.exit(1);
});
