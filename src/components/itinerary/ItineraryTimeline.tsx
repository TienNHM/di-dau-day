'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { formatDuration, formatPrice } from '@/components/result/ResultCard';
import { accentFor } from '@/lib/intents/accents';
import { ITINERARY_SLOTS, decodeItinerarySlugs } from '@/lib/recommend/itinerary';
import { CITY_QUERY_KEY } from '@/lib/recommend/criteria';
import { track } from '@/lib/analytics/track';
import { SITE_NAME } from '@/lib/site';
import { useItineraryCards } from '@/lib/places/useItineraryCards';

/**
 * A plan the user can follow without thinking again.
 *
 * The itinerary lives entirely in the URL (`?d=slug,slug,slug&tp=city`), so it is
 * shareable and bookmarkable with no server and no stored state. The page itself is
 * one static file; the stops are looked up client-side in a card index fetched for
 * that one city, rather than in an index of everything baked into the HTML.
 */

export type ItineraryCard = {
  readonly slug: string;
  readonly name: string;
  readonly category: Parameters<typeof accentFor>[0];
  readonly districtName: string | null;
  readonly address: string;
  readonly avgPrice?: number;
  readonly durationMinutes?: readonly [number, number];
  readonly editorialNote?: string;
  readonly directionsUrl: string;
};

export function ItineraryTimeline({ siteUrl }: { siteUrl: string }) {
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const { status, cards } = useItineraryCards();

  const stops = useMemo(() => {
    const bySlug = new Map(cards.map((card) => [card.slug, card]));
    return decodeItinerarySlugs(searchParams.get('d'))
      .map((slug) => bySlug.get(slug))
      .filter((card): card is ItineraryCard => card !== undefined);
  }, [cards, searchParams]);

  const rerollHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('d');
    params.delete('tu');
    params.set('spin', '1');
    return `/hen-ho/?${params.toString()}`;
  }, [searchParams]);

  const totals = useMemo(() => {
    const prices = stops.map((stop) => stop.avgPrice);
    const durations = stops.map((stop) => stop.durationMinutes);

    return {
      price: prices.every((p): p is number => p !== undefined)
        ? prices.reduce((a, b) => a + b, 0)
        : null,
      minutes: durations.every((d): d is readonly [number, number] => d !== undefined)
        ? ([
            durations.reduce((sum, [min]) => sum + min, 0),
            durations.reduce((sum, [, max]) => sum + max, 0),
          ] as const)
        : null,
    };
  }, [stops]);

  async function handleShare() {
    track('share_click', { kind: 'itinerary' });

    // The city travels with the link: without it the recipient's own stored city
    // decides which shard is searched, and these slugs would be missing from it.
    const shared = new URLSearchParams({ d: stops.map((s) => s.slug).join(',') });
    const city = searchParams.get(CITY_QUERY_KEY);
    if (city) shared.set(CITY_QUERY_KEY, city);

    const url = `${siteUrl}/lich-trinh/?${shared.toString()}`;
    const text = `${SITE_NAME} lên kế hoạch giùm: ${stops.map((s) => s.name).join(' → ')}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch {
        // A dismissed share sheet throws the same way a failure does; fall through.
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard can be blocked outright; the URL is in the address bar regardless.
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-1 flex-col gap-4" aria-busy>
        <div className="h-10 w-2/3 animate-pulse rounded-xl bg-cream-deep" />
        <div className="h-44 animate-pulse rounded-card bg-cream-deep" />
        <div className="h-44 animate-pulse rounded-card bg-cream-deep" />
        <div className="h-44 animate-pulse rounded-card bg-cream-deep" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-5xl" aria-hidden>
          📡
        </p>
        <h1 className="text-2xl font-bold">Chưa tải được kế hoạch</h1>
        <p className="max-w-xs text-ink-soft">
          Mạng đang trục trặc. Link vẫn còn nguyên — thử tải lại trang nhé.
        </p>
      </div>
    );
  }

  // Only meaningful once the index has loaded: before that, every plan looks
  // unreadable simply because nothing has been looked up yet.
  if (stops.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-5xl" aria-hidden>
          🗺️
        </p>
        <h1 className="text-2xl font-bold">Không đọc được kế hoạch này</h1>
        <p className="max-w-xs text-ink-soft">
          Link có thể đã cũ hoặc bị cắt mất. Thử để tụi mình lên một buổi mới xem sao.
        </p>
        <Link href="/hen-ho" className="rounded-2xl bg-ink px-5 py-3 font-semibold text-cream">
          Lên kế hoạch mới
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.22em] text-ink-faint uppercase">
          Kế hoạch cho buổi hẹn
        </p>
        <h1 className="mt-3 text-4xl leading-tight font-extrabold tracking-tight text-balance">
          {stops.length} chặng, một buổi tối
        </h1>

        {totals.price !== null || totals.minutes !== null ? (
          <p className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-ink-soft">
            {totals.price !== null ? (
              <span className="rounded-full bg-white/70 px-3 py-1.5 ring-1 ring-line">
                💰 {formatPrice(totals.price)} / người
              </span>
            ) : null}
            {totals.minutes !== null ? (
              <span className="rounded-full bg-white/70 px-3 py-1.5 ring-1 ring-line">
                ⏱ {formatDuration(totals.minutes)}
              </span>
            ) : null}
          </p>
        ) : null}
      </header>

      <ol className="flex flex-col">
        {stops.map((stop, index) => {
          const definition = ITINERARY_SLOTS[index];
          const accent = accentFor(stop.category);
          const isLast = index === stops.length - 1;

          return (
            <li key={stop.slug} className="flex gap-4">
              {/* The rail is what makes this read as a sequence rather than a list. */}
              <div className="flex flex-col items-center" aria-hidden>
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl"
                  style={{
                    backgroundImage: `linear-gradient(140deg, ${accent.from}, ${accent.to})`,
                  }}
                >
                  {definition?.emoji ?? '📍'}
                </span>
                {!isLast ? <span className="w-0.5 flex-1 bg-line" /> : null}
              </div>

              <div className={isLast ? 'flex-1' : 'flex-1 pb-6'}>
                <p className="text-xs font-semibold tracking-wider text-ink-faint uppercase">
                  {definition?.label ?? 'Chặng tiếp theo'}
                </p>

                <Link
                  href={`/dia-diem/${stop.slug}/` as Route}
                  className="mt-1 block text-xl font-bold underline-offset-4 hover:underline"
                >
                  {stop.name}
                </Link>

                {stop.editorialNote ? (
                  <p className="mt-1.5 text-sm text-ink-soft">{stop.editorialNote}</p>
                ) : null}

                <p className="mt-2 text-sm text-ink-faint">
                  📍 {stop.districtName ?? stop.address}
                  {stop.avgPrice !== undefined ? ` · 💰 ${formatPrice(stop.avgPrice)}` : ''}
                </p>

                <a
                  href={stop.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('directions_click', { place: stop.slug })}
                  className="mt-2.5 inline-block rounded-xl bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-line"
                >
                  🧭 Đường đi
                </a>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleShare}
          className="rounded-2xl bg-white px-4 py-3.5 font-semibold ring-1 ring-line transition active:scale-[0.98]"
        >
          {copied ? '✅ Đã copy' : '📤 Chia sẻ'}
        </button>
        <Link
          href={rerollHref as Route}
          onClick={() => track('reroll_click', { kind: 'itinerary' })}
          className="rounded-2xl bg-white px-4 py-3.5 text-center font-semibold ring-1 ring-line transition active:scale-[0.98]"
        >
          🎲 Lên lại
        </Link>
      </div>

      <section className="rounded-card border-2 border-dashed border-line p-6 text-center">
        <p className="text-lg font-bold text-balance">Tới lượt bạn</p>
        <p className="mt-1 text-sm text-ink-soft">Không biết đi đâu? Để tụi mình chọn cho.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-2xl bg-ink px-6 py-3.5 font-bold text-cream transition active:scale-[0.98]"
        >
          🎲 Thử cho tôi
        </Link>
      </section>
    </div>
  );
}
