'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useCityShard } from '@/lib/places/useCityShard';
import { placesForDish } from '@/lib/dishes/match';
import { getDish } from '@/lib/dishes/catalogue';
import { isOpenAt } from '@/lib/time/open-now';
import { track } from '@/lib/analytics/track';

/**
 * Where to eat the dish that was just picked.
 *
 * Resolved in the browser, not at build time, because the answer depends on which
 * city the visitor is in and the page itself is one static file per dish. The shard
 * is normally already cached from the spin that led here, so this list costs nothing.
 *
 * Open places are shown first. At the moment somebody is deciding what to eat, a
 * closed restaurant is not a worse suggestion — it is not a suggestion.
 */

const SHOWN = 12;

export function DishPlaces({ dishId }: { dishId: string }) {
  const dish = getDish(dishId);
  const { status, places, districts } = useCityShard();

  const matches = useMemo(() => {
    if (!dish || status !== 'ready') return [];
    const now = new Date();

    return placesForDish(places, dish)
      .map((place) => ({ place, open: isOpenAt(place.openingHours, now) }))
      .sort((a, b) => {
        const rank = (state: string) => (state === 'open' ? 0 : state === 'unknown' ? 1 : 2);
        return rank(a.open) - rank(b.open);
      })
      .slice(0, SHOWN);
  }, [dish, places, status]);

  const districtName = useMemo(() => {
    const byId = new Map(districts.map((district) => [district.id, district.shortName]));
    return (id: string) => byId.get(id) ?? null;
  }, [districts]);

  if (!dish) return null;

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-2.5" aria-busy>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-cream-deep" />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-deep">
        Chưa tải được danh sách quán. Kiểm tra mạng rồi tải lại trang nhé.
      </p>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-card bg-white/70 p-5 text-center ring-1 ring-line">
        <p className="text-ink-soft">
          Thành phố bạn đang chọn chưa có chỗ nào cho món này trong dữ liệu của tụi mình.
        </p>
        <Link
          href="/dong-gop"
          className="mt-4 inline-block rounded-2xl bg-ink px-5 py-3 font-semibold text-cream"
        >
          Bạn biết chỗ nào không?
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {matches.map(({ place, open }) => (
        <li key={place.slug}>
          <Link
            href={`/dia-diem/${place.slug}/` as Route}
            onClick={() => track('dish_place_click', { dish: dishId, place: place.slug })}
            className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3.5 ring-1 ring-line transition active:scale-[0.99] hover:bg-white"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{place.name}</span>
              <span className="block text-sm text-ink-faint">
                {districtName(place.districtId) ?? 'Không rõ khu'}
                {open === 'open' ? ' · 🟢 đang mở' : open === 'closed' ? ' · 🔴 đang đóng' : ''}
              </span>
            </span>
            <span aria-hidden className="text-ink-faint">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
