'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Route } from 'next';
import { SpinStage } from '@/components/spin/SpinStage';
import { useCityShard } from '@/lib/places/useCityShard';
import { dishesOfKind } from '@/lib/dishes/catalogue';
import { availableDishes } from '@/lib/dishes/match';
import { CITY_QUERY_KEY } from '@/lib/recommend/criteria';
import { track } from '@/lib/analytics/track';
import type { Accent } from '@/lib/intents/registry';
import type { DishKind } from '@/lib/dishes/types';

/**
 * "I don't know what to eat" — answered with a dish rather than a place.
 *
 * A different question from the rest of the product, and deliberately a shorter one:
 * no companion, no budget, no district. Somebody who cannot decide what to eat is not
 * in the mood to answer three questions about it. One tap, one dish, then the places
 * that serve it.
 *
 * Only dishes the visitor's city can actually follow through on are in the reel, so
 * the answer is never one the next screen cannot support.
 */
export function DishSpinner({
  kind,
  accent,
  title,
  subtitle,
}: {
  kind: DishKind;
  accent: Accent;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const { status, places, cityId } = useCityShard();
  const [spinning, setSpinning] = useState(false);

  const matches = useMemo(
    () => (status === 'ready' ? availableDishes(places, dishesOfKind(kind)) : []),
    [status, places, kind],
  );

  /**
   * Chosen when the spin starts, not when it ends.
   *
   * The reel has to know its own last slot in order to land on it, so picking at the
   * end would mean the winner was never on the strip the user watched go past.
   */
  const [winner, setWinner] = useState<string | null>(null);

  const start = useCallback(() => {
    if (matches.length === 0) return;
    const picked = matches[Math.floor(Math.random() * matches.length)]!;
    track('dish_spin_start', { kind, dish: picked.dish.id });
    setWinner(picked.dish.id);
    setSpinning(true);
  }, [matches, kind]);

  const handleComplete = useCallback(() => {
    if (!winner) return;
    router.push(`/mon/${winner}/?${CITY_QUERY_KEY}=${cityId}` as Route);
  }, [winner, cityId, router]);

  if (spinning && winner) {
    const picked = matches.find((match) => match.dish.id === winner);
    return (
      <SpinStage
        candidates={matches.map((match) => `${match.dish.emoji} ${match.dish.name}`)}
        winnerLabel={`${picked?.dish.emoji ?? '🍽️'} ${picked?.dish.name ?? ''}`}
        landedNote={picked ? `${picked.places.length} chỗ có món này` : undefined}
        waitingNote={`Đang xáo ${matches.length} món`}
        accent={accent}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-4">
        <span />
        <Link
          href="/"
          className="text-sm font-medium text-ink-faint underline-offset-4 hover:text-ink hover:underline"
        >
          Về trang chủ
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <p className="text-6xl" aria-hidden>
          {kind === 'mon-an' ? '🍜' : '🧋'}
        </p>
        <h1 className="mt-6 text-4xl leading-tight font-extrabold tracking-tight text-balance">
          {title}
        </h1>
        <p className="mt-3 max-w-sm text-lg text-ink-soft">{subtitle}</p>

        {status === 'error' ? (
          <p className="mt-6 text-sm font-medium text-brand-deep">
            Chưa tải được dữ liệu. Kiểm tra mạng rồi thử lại nhé.
          </p>
        ) : null}

        {/* A city with too little data would otherwise promise a shuffle it cannot
            perform. Saying so beats spinning to an empty result. */}
        {status === 'ready' && matches.length === 0 ? (
          <p className="mt-6 max-w-xs text-sm text-ink-soft">
            Thành phố này chưa đủ dữ liệu cho mục này. Bạn đổi thành phố ở trang chủ, hoặc{' '}
            <Link href="/dong-gop" className="underline underline-offset-4">
              gợi ý chỗ mới
            </Link>{' '}
            giúp tụi mình nhé.
          </p>
        ) : null}
      </div>

      <div className="mt-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={start}
          disabled={status !== 'ready' || matches.length === 0}
          className="w-full rounded-2xl px-5 py-4 text-lg font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundImage: `linear-gradient(120deg, ${accent.from}, ${accent.to})` }}
        >
          {status === 'loading' ? 'Đang tải…' : '🎲 Chọn giùm tôi'}
        </button>

        {status === 'ready' && matches.length > 0 ? (
          <p className="mt-3 text-center text-sm text-ink-faint">
            {matches.length} món đang có ở thành phố của bạn
          </p>
        ) : null}
      </div>
    </div>
  );
}
