import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { DISHES } from '../src/lib/dishes/catalogue';

/**
 * Every dish photo on one sheet, for looking at.
 *
 *   pnpm data:photos:sheet      # writes sheet.jpg
 *
 * Reviewing 34 images one file at a time is how three wrong ones shipped. Seeing them
 * together is how the fourth was caught — "bún bò" had been given the identical
 * photograph as "phở", which is invisible until they are side by side.
 */
async function main() {
  const photos = JSON.parse(readFileSync('data/dish-photos.json', 'utf8')) as {
    dishId: string;
    file: string;
  }[];

  const order = DISHES.map((d) => d.id).filter((id) => photos.some((p) => p.dishId === id));

  const COLS = 5;
  const W = 288;
  const H = 192;
  const rows = Math.ceil(order.length / COLS);

  const tiles: OverlayOptions[] = await Promise.all(
    order.map(async (id, i) => ({
      input: await sharp(`public/dish/${id}.jpg`).resize(W, H, { fit: 'cover' }).toBuffer(),
      left: (i % COLS) * W,
      top: Math.floor(i / COLS) * H,
    })),
  );

  await sharp({ create: { width: COLS * W, height: rows * H, channels: 3, background: '#fff' } })
    .composite(tiles)
    .jpeg({ quality: 84 })
    .toFile('sheet.jpg');

  console.log('sheet.jpg — thứ tự:');

  order.forEach((id, i) => {
    if (i % COLS === 0) process.stdout.write(`\nhàng ${Math.floor(i / COLS) + 1}: `);
    process.stdout.write(`${id}  `);
  });
  process.stdout.write('\n');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
