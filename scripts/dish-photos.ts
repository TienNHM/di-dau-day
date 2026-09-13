import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { DISHES } from '../src/lib/dishes/catalogue';
import type { Dish } from '../src/lib/dishes/types';

/**
 * One photograph per dish, from Pexels.
 *
 *   PEXELS_API_KEY=... pnpm data:photos
 *   PEXELS_API_KEY=... pnpm data:photos --force
 *
 * Wikimedia Commons was tried first and abandoned. Its licence metadata is excellent
 * and its food photography is not: the candidates for "phở" came back as fireworks
 * and seashells, for "bún chả" a church, for "cơm tấm" a baobab tree. Commons search
 * is AND across every word and ranks on file names, so a dish either matched nothing
 * or matched something unrelated that happened to share a syllable.
 *
 * Google Images and Pinterest are not an option. Both are indexes of other people's
 * copyrighted photographs; republishing from them on a commercial site is
 * infringement, and it is the same thing this project's own contribution terms forbid
 * contributors from doing.
 *
 * The Pexels licence allows commercial use and modification and requires no
 * attribution. Credit is recorded and shown anyway — it costs one line, and the
 * photographers are the reason the page looks like anything.
 *
 * Images are committed rather than fetched during a build, so no build depends on
 * Pexels being reachable and each photo stays pinned to the one that was reviewed.
 */

const OUT_DIR = join(process.cwd(), 'public', 'dish');
const CREDITS_PATH = join(process.cwd(), 'data', 'dish-photos.json');

const WIDTH = 720;
const HEIGHT = 480;

export type DishPhoto = {
  readonly dishId: string;
  readonly file: string;
  readonly author: string;
  readonly sourceUrl: string;
};

/**
 * Search terms, in English, because that is the language Pexels is indexed in — "phở"
 * returns almost nothing while "pho noodle soup" returns hundreds.
 *
 * Where a Vietnamese dish has no stock-photo presence at all, the term names the
 * closest honest thing rather than substituting a different dish.
 */
const QUERIES: Record<string, string> = {
  pho: 'pho vietnamese noodle soup',
  'bun-bo': 'vietnamese beef noodle soup',
  'bun-cha': 'grilled pork noodles vietnamese',
  'com-tam': 'grilled pork rice plate',
  'com-ga': 'chicken rice plate',
  'banh-mi': 'banh mi sandwich',
  'banh-xeo': 'vietnamese pancake',
  'banh-canh': 'noodle soup bowl',
  'banh-cuon': 'steamed rice rolls',
  'hu-tieu': 'vietnamese noodle bowl',
  chao: 'rice porridge congee',
  lau: 'hot pot',
  nuong: 'grilled skewers barbecue',
  'hai-san': 'seafood platter',
  oc: 'snails seafood',
  chay: 'vegetarian food plate',
  'com-viet': 'vietnamese food rice',
  'mon-han': 'korean food',
  'mon-nhat': 'ramen japanese',
  sushi: 'sushi',
  'mon-hoa': 'dim sum',
  'mon-thai': 'thai food',
  pizza: 'pizza',
  'ga-ran': 'fried chicken',
  burger: 'burger',
  'an-vat': 'street food',
  'ca-phe': 'vietnamese iced coffee',
  'tra-sua': 'bubble tea',
  tra: 'tea cup',
  'sinh-to': 'smoothie',
  kem: 'ice cream',
  'banh-ngot': 'cake dessert',
  bia: 'beer glass',
  cocktail: 'cocktail',
};

type PexelsPhoto = {
  photographer: string;
  url: string;
  src: { large2x?: string; large?: string; original?: string };
};

function queryFor(dish: Dish): string {
  return QUERIES[dish.id] ?? dish.name;
}

async function search(key: string, query: string): Promise<PexelsPhoto[]> {
  const params = new URLSearchParams({
    query,
    per_page: '5',
    // Landscape only: the card is wider than it is tall, and a portrait photograph
    // cropped to it loses the plate.
    orientation: 'landscape',
  });

  const response = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
    headers: { Authorization: key },
  });
  if (!response.ok) throw new Error(`Pexels trả về HTTP ${response.status}`);

  const body = (await response.json()) as { photos?: PexelsPhoto[] };
  return body.photos ?? [];
}

async function main() {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    console.error(
      'Thiếu PEXELS_API_KEY.\n\n' +
        '  1. Lấy key miễn phí tại https://www.pexels.com/api/ (khoảng hai phút)\n' +
        '  2. PEXELS_API_KEY=<key> pnpm data:photos\n\n' +
        'Giấy phép Pexels cho phép dùng thương mại và chỉnh sửa, không bắt buộc ghi nguồn.',
    );
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  await mkdir(OUT_DIR, { recursive: true });

  const existing = JSON.parse(await readFile(CREDITS_PATH, 'utf8').catch(() => '[]')) as DishPhoto[];
  const credits = new Map(existing.map((photo) => [photo.dishId, photo]));

  for (const dish of DISHES) {
    if (!force && credits.has(dish.id)) continue;

    let photos: PexelsPhoto[];
    try {
      photos = await search(key, queryFor(dish));
    } catch (error) {
      console.log(`  ${dish.name.padEnd(20)} — ${String(error)}`);
      continue;
    }

    const photo = photos[0];
    const source = photo?.src.large2x ?? photo?.src.large ?? photo?.src.original;
    if (!photo || !source) {
      console.log(`  ${dish.name.padEnd(20)} — không có ảnh nào`);
      continue;
    }

    const image = await fetch(source);
    if (!image.ok) {
      console.log(`  ${dish.name.padEnd(20)} — tải ảnh lỗi HTTP ${image.status}`);
      continue;
    }

    // Centre crop. Sharp's "attention" heuristic picked the busiest corner of a plate
    // and cut the dish in half, which was half of why the first attempt looked wrong.
    const buffer = await sharp(Buffer.from(await image.arrayBuffer()))
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    const file = `${dish.id}.jpg`;
    await writeFile(join(OUT_DIR, file), buffer);

    credits.set(dish.id, {
      dishId: dish.id,
      file,
      author: photo.photographer,
      sourceUrl: photo.url,
    });

    console.log(
      `  ${dish.name.padEnd(20)} ${(buffer.length / 1024).toFixed(0).padStart(4)} KB  ${photo.photographer}`,
    );
  }

  // A dish dropped from the catalogue must not leave its image behind.
  const wanted = new Set(DISHES.map((dish) => dish.id));
  for (const dishId of [...credits.keys()]) {
    if (!wanted.has(dishId)) {
      credits.delete(dishId);
      await rm(join(OUT_DIR, `${dishId}.jpg`), { force: true });
    }
  }

  const sorted = [...credits.values()].sort((a, b) => a.dishId.localeCompare(b.dishId));
  await writeFile(CREDITS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);

  const missing = DISHES.filter((dish) => !credits.has(dish.id));
  console.log(`\n✓ ${sorted.length}/${DISHES.length} món có ảnh.`);
  if (missing.length > 0) {
    console.log(`⚠ Thiếu: ${missing.map((dish) => dish.name).join(', ')}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
