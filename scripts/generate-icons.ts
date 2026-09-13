import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/**
 * Rasterises `public/icon.svg` into the PNG sizes browsers actually ask for.
 *
 * Not Next's `icon.tsx` convention: that emits a file with no extension, and GitHub
 * Pages picks Content-Type from the extension — the same trap that broke the Open
 * Graph images. Real `.png` files avoid it.
 *
 * Generated rather than committed so the SVG stays the single source of truth; there
 * is no way for the raster and the vector to drift apart.
 */

const SIZES = [
  // The classic favicon sizes. Modern browsers prefer the SVG, but Safari and older
  // Android pick from these.
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-192.png', size: 192 },
  // iOS home-screen icon. It ignores transparency and SVG both, so this one matters.
  { file: 'apple-touch-icon.png', size: 180 },
];

async function main() {
  const publicDir = join(process.cwd(), 'public');
  const svg = await readFile(join(publicDir, 'icon.svg'));

  await Promise.all(
    SIZES.map(async ({ file, size }) => {
      const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
      await writeFile(join(publicDir, file), png);
      return `${file} (${(png.length / 1024).toFixed(1)} KB)`;
    }),
  ).then((lines) => lines.forEach((line) => console.log(`  ${line}`)));

  console.log(`✓ ${SIZES.length} icon → public/`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
