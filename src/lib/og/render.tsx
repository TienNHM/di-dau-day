import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { accentFor } from '@/lib/intents/accents';
import { formatPrice } from '@/components/result/ResultCard';
import type { District, Place } from '@/lib/places/types';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

/**
 * Share image, 1200×630.
 *
 * This is the whole first impression for anyone who meets the product through a link
 * in a Facebook or Zalo feed, so it carries the answer itself rather than a logo.
 *
 * Fonts are read from the repo instead of fetched, so a build never depends on a
 * font CDN being reachable — and so Vietnamese diacritics are guaranteed present,
 * which the default satori font does not cover.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

const fontPath = (weight: number) =>
  join(process.cwd(), 'src', 'assets', 'fonts', `BeVietnamPro-${weight}.ttf`);

/** Satori does not shrink text to fit, so the size steps down by name length. */
function titleSize(name: string): number {
  if (name.length > 34) return 68;
  if (name.length > 22) return 84;
  return 104;
}

export async function renderPlaceOgImage(
  place: Place,
  district: District | null,
): Promise<ImageResponse> {
  const accent = accentFor(place.category);
  const [bold, extraBold] = await Promise.all([readFile(fontPath(700)), readFile(fontPath(800))]);

  const facts = [
    district ? `📍 ${district.shortName}` : null,
    place.avgPrice !== undefined ? `💰 ${formatPrice(place.avgPrice)}` : null,
    place.rating !== undefined ? `⭐ ${place.rating}` : null,
  ].filter((fact): fact is string => fact !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundImage: `linear-gradient(150deg, ${accent.from}, ${accent.to})`,
          color: accent.on,
          fontFamily: 'Be Vietnam Pro',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, opacity: 0.85 }}>
          🎲 {SITE_NAME} vừa chọn
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: titleSize(place.name),
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            {place.name}
          </div>

          {facts.length > 0 ? (
            <div style={{ display: 'flex', gap: 20, marginTop: 32 }}>
              {facts.map((fact) => (
                <div
                  key={fact}
                  style={{
                    display: 'flex',
                    padding: '12px 26px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.22)',
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  {fact}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, opacity: 0.85 }}>
          Bạn dám để tụi mình chọn cho không?
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Be Vietnam Pro', data: bold, weight: 700, style: 'normal' },
        { name: 'Be Vietnam Pro', data: extraBold, weight: 800, style: 'normal' },
      ],
    },
  );
}

/** Share image for the landing page — the one people post when recommending the site itself. */
export async function renderBrandOgImage(): Promise<ImageResponse> {
  const [bold, extraBold] = await Promise.all([readFile(fontPath(700)), readFile(fontPath(800))]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundImage: 'linear-gradient(150deg, #ef4d23, #f5a524)',
          color: '#ffffff',
          fontFamily: 'Be Vietnam Pro',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, opacity: 0.85 }}>
          📍 TP. Hồ Chí Minh
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 128,
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            marginTop: 24,
          }}
        >
          Đi đâu đây?
        </div>
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, opacity: 0.9, marginTop: 28 }}>
          {SITE_TAGLINE}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Be Vietnam Pro', data: bold, weight: 700, style: 'normal' },
        { name: 'Be Vietnam Pro', data: extraBold, weight: 800, style: 'normal' },
      ],
    },
  );
}
