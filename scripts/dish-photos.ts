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
const URLS_PATH = join(process.cwd(), 'data', 'dish-photo-urls.json');

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
  'bun-bo': 'bun bo hue beef noodle',
  'bun-cha': 'grilled pork noodles vietnamese',
  'com-tam': 'grilled pork rice plate',
  'com-ga': 'chicken rice bowl asian',
  'banh-mi': 'banh mi sandwich',
  'banh-xeo': 'banh xeo',
  'banh-canh': 'noodle soup bowl',
  'banh-cuon': 'steamed dumpling rolls plate',
  'hu-tieu': 'pork noodle soup bowl',
  chao: 'rice porridge congee',
  lau: 'hotpot soup vegetables table',
  nuong: 'grilled skewers barbecue',
  'hai-san': 'seafood platter',
  oc: 'snails seafood',
  chay: 'vegetarian food plate',
  'com-viet': 'vietnamese food rice',
  'mon-han': 'korean food',
  'mon-nhat': 'ramen japanese',
  sushi: 'sushi rolls plate salmon',
  'mon-hoa': 'dim sum',
  'mon-thai': 'tom yum soup thai dish',
  pizza: 'pizza',
  'ga-ran': 'fried chicken',
  burger: 'burger',
  'an-vat': 'fried snacks skewers plate',
  'ca-phe': 'vietnamese iced coffee',
  'tra-sua': 'boba milk tea glass',
  tra: 'tea cup',
  'sinh-to': 'smoothie',
  kem: 'ice cream',
  'banh-ngot': 'cake dessert',
  bia: 'beer glass',
  cocktail: 'cocktail',
};

/**
 * Hand-picked photographs, and deliberate blanks.
 *
 *   "banh-xeo": "https://www.pexels.com/photo/.../12386427/"   use exactly this one
 *   "banh-canh": null                                          no photo, stop looking
 *
 * Search cannot tell a bowl of bánh canh from any other noodle soup, and it kept
 * confidently labelling the wrong dish. A person looking at a photo and saying "that
 * one" is the only reliable step in this pipeline, so the file exists to record those
 * decisions — and `null` records the decision that nothing suitable exists, which
 * otherwise got silently overturned by the next run.
 */
type PexelsPhoto = {
  photographer: string;
  url: string;
  src: { large2x?: string; large?: string; original?: string };
};

function queryFor(dish: Dish): string {
  return QUERIES[dish.id] ?? dish.name;
}

/** Pexels URLs end in the photo id: .../healthy-meal-with-sauce-on-plate-12386427/ */
function photoIdFrom(url: string): string | null {
  return /-(\d+)\/?$/.exec(url.trim())?.[1] ?? null;
}

async function fetchById(key: string, id: string): Promise<PexelsPhoto | null> {
  const response = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
    headers: { Authorization: key },
  });
  if (!response.ok) return null;
  return (await response.json()) as PexelsPhoto;
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
  // The key lives in .env, which is gitignored. Loaded here so the command is just
  // `pnpm data:photos` rather than something with a secret typed on the command line
  // — shell history is a place secrets should not end up.
  try {
    process.loadEnvFile();
  } catch {
    // No .env at all is fine; the environment may carry the key directly.
  }

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
  /*
   * `--only=pho,lau` refetches just those dishes.
   *
   * Choosing photographs is iterative — a query gets tuned, one dish is refetched and
   * looked at again — and refetching everything each round would churn images that
   * were already fine, and burn the quota doing it.
   */
  const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
  const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null;

  await mkdir(OUT_DIR, { recursive: true });

  const existing = JSON.parse(await readFile(CREDITS_PATH, 'utf8').catch(() => '[]')) as DishPhoto[];
  const credits = new Map(existing.map((photo) => [photo.dishId, photo]));

  /*
   * `--drop=banh-cuon` removes a photo entirely.
   *
   * Some dishes have no usable stock photograph — bánh cuốn returns stacks of rice
   * paper, bánh xèo returns an American breakfast. A wrong picture of a dish is worse
   * than none: the emoji fallback is honest, and a photo of the wrong food beside the
   * name is a small lie the reader has no way to catch.
   */
  const dropArg = process.argv.find((arg) => arg.startsWith('--drop='));
  const dropped = new Set(dropArg ? dropArg.slice('--drop='.length).split(',') : []);
  for (const dishId of dropped) {
    credits.delete(dishId);
    await rm(join(OUT_DIR, `${dishId}.jpg`), { force: true });
    console.log(`  bỏ ảnh: ${dishId}`);
  }

  /*
   * Two dishes must not share a photograph.
   *
   * "Bún bò" was handed the identical image as "Phở" — both are beef noodle soup and
   * Pexels ranked the same photo first for each. On the page that reads as a bug, and
   * worse, as a claim that the two dishes look the same.
   */
  const usedPhotos = new Set([...credits.values()].map((photo) => photo.sourceUrl));

  const chosen = JSON.parse(
    await readFile(URLS_PATH, 'utf8').catch(() => '{}'),
  ) as Record<string, string | null>;

  for (const dish of DISHES) {
    // A deliberate blank. Recorded rather than merely absent, so the next run does
    // not helpfully search again and reinstate the photo that was rejected.
    if (dish.id in chosen && chosen[dish.id] === null) {
      credits.delete(dish.id);
      await rm(join(OUT_DIR, `${dish.id}.jpg`), { force: true });
      continue;
    }
    // A dropped dish must stay dropped: removing its credit then falling into the
    // fetch below would immediately download the same wrong photo again.
    if (dropped.has(dish.id)) continue;
    const isPinned = Boolean(chosen[dish.id]);
    const alreadyPinned = isPinned && credits.get(dish.id)?.sourceUrl === chosen[dish.id];
    if (only ? !only.has(dish.id) : !force && credits.has(dish.id) && (!isPinned || alreadyPinned)) {
      continue;
    }
    if (only?.has(dish.id)) usedPhotos.delete(credits.get(dish.id)?.sourceUrl ?? '');

    const pinned = chosen[dish.id];
    let photos: PexelsPhoto[];
    try {
      if (pinned) {
        const id = photoIdFrom(pinned);
        if (!id) {
          console.log(`  ${dish.name.padEnd(20)} — link Pexels không đọc được id: ${pinned}`);
          continue;
        }
        const one = await fetchById(key, id);
        photos = one ? [one] : [];
      } else {
        photos = await search(key, queryFor(dish));
      }
    } catch (error) {
      console.log(`  ${dish.name.padEnd(20)} — ${String(error)}`);
      continue;
    }

    // A pinned photo is used even if another dish already has it: the person choosing
    // it saw both and meant this one.
    const photo = pinned ? photos[0] : photos.find((candidate) => !usedPhotos.has(candidate.url));
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

    usedPhotos.add(photo.url);
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
