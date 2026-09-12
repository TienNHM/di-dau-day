import type { NextConfig } from 'next';

/**
 * Deploy target: GitHub Pages (pure static hosting).
 *
 * Consequences encoded here:
 * - `output: 'export'` — no server, no route handlers, no ISR, no middleware.
 * - `trailingSlash` — Pages serves `<route>/index.html`, so routes must be emitted
 *   as directories rather than bare `.html` files.
 * - `images.unoptimized` — there is no image optimizer in a static export.
 *
 * `basePath` is empty for the custom domain (didauday.tiennhm.io.vn serves at root).
 * It stays configurable so the same build works under github.io/<repo> for previews.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
