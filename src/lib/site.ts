/**
 * Site-level constants.
 *
 * `SITE_URL` must be absolute: Open Graph consumers (Facebook, Zalo, Messenger)
 * reject relative image URLs, and the share flow is the whole point of the product.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://didauday.tiennhm.io.vn'
).replace(/\/$/, '');

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const SITE_NAME = 'Đi Đâu Đây?';
export const SITE_TAGLINE = 'Không biết đi đâu? Để tụi mình chọn cho.';
export const SITE_DESCRIPTION =
  'Không biết hôm nay ăn gì, đi đâu, chơi gì? Trả lời vài câu hỏi, tụi mình chọn giúp bạn một chỗ ở TP.HCM, Hà Nội, Đà Nẵng và nhiều thành phố khác — trong 15 giây.';

export const DEFAULT_CITY_ID = 'ho-chi-minh';

/**
 * Where place suggestions go.
 *
 * Defaults to a GitHub issue on this repo because that needs no setup and works the
 * day the site goes live. Point `NEXT_PUBLIC_SUGGEST_FORM_URL` at a Google Form
 * instead once contributions come from people who do not have GitHub accounts.
 */
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? 'https://github.com/TienNHM/di-dau-day';
export const SUGGEST_FORM_URL = process.env.NEXT_PUBLIC_SUGGEST_FORM_URL ?? null;

/** Absolute URL for a path, for canonical + OG tags. */
export function absoluteUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${BASE_PATH}${clean}`;
}
