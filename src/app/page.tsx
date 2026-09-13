import type { Metadata } from 'next';
import Link from 'next/link';
import { CityPicker } from '@/components/city/CityPicker';
import { IntentCard } from '@/components/intent/IntentCard';
import { PageShell } from '@/components/ui/PageShell';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { INTENTS } from '@/lib/intents/registry';
import { getPlaceRepository } from '@/lib/places/static-repository';
import { absoluteUrl, SITE_TAGLINE } from '@/lib/site';

/**
 * Landing. One job: get the user into an intent in a single tap.
 *
 * An intent is offered only when seed data actually exists for its categories, so
 * intents light up on their own as data lands — no manual enabling, and never a
 * flow that ends in "không tìm thấy gì".
 */
// Declared here rather than in the root layout: an inherited canonical would make
// any page that forgot to set its own claim to be the homepage.
export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl('/') },
};

export default async function HomePage() {
  const repo = getPlaceRepository();
  const [cities, places] = await Promise.all([repo.listCities(), repo.listPlaces()]);

  // Only offer cities that actually have places — a picker entry that leads nowhere
  // is worse than a shorter list.
  const countByCity = new Map<string, number>();
  for (const place of places) {
    countByCity.set(place.location.cityId, (countByCity.get(place.location.cityId) ?? 0) + 1);
  }

  const available = cities
    .filter((city) => (countByCity.get(city.id) ?? 0) > 0)
    .map((city) => ({ city, placeCount: countByCity.get(city.id)! }))
    .sort((a, b) => b.placeCount - a.placeCount);

  const populated = new Set(places.map((place) => place.category));

  return (
    <PageShell>
      <main className="flex flex-1 flex-col justify-center py-10">
        <CityPicker options={available} />

        <h1 className="mt-4 text-5xl leading-[0.95] font-extrabold tracking-tight text-balance sm:text-6xl">
          Đi đâu
          <br />
          <span className="bg-gradient-to-br from-brand to-sun bg-clip-text text-transparent">
            đây?
          </span>
        </h1>

        <p className="mt-4 max-w-sm text-lg text-ink-soft text-balance">{SITE_TAGLINE}</p>

        <nav aria-label="Chọn nhu cầu" className="mt-9 flex flex-col gap-3">
          {INTENTS.map((intent) => (
            <IntentCard
              key={intent.id}
              intent={intent}
              available={intent.categories.some((category) => populated.has(category))}
            />
          ))}
        </nav>

        {/*
          A different question from the five above, and kept visually apart for that
          reason. Those five ask "where"; these two ask "what" — the case where
          somebody has already decided to eat and still cannot get started.
        */}
        <section className="mt-8 border-t border-line pt-7">
          <h2 className="text-sm font-semibold tracking-wider text-ink-faint uppercase">
            Chưa biết ăn gì, uống gì?
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link
              href="/mon-an"
              className="flex flex-col gap-1 rounded-2xl bg-white/70 px-4 py-4 ring-1 ring-line transition active:scale-[0.98] hover:bg-white"
            >
              <span aria-hidden className="text-3xl">
                🍜
              </span>
              <span className="font-bold">Random món ăn</span>
              <span className="text-sm text-ink-faint">Chọn món trước, quán sau</span>
            </Link>

            <Link
              href="/do-uong"
              className="flex flex-col gap-1 rounded-2xl bg-white/70 px-4 py-4 ring-1 ring-line transition active:scale-[0.98] hover:bg-white"
            >
              <span aria-hidden className="text-3xl">
                🧋
              </span>
              <span className="font-bold">Random đồ uống</span>
              <span className="text-sm text-ink-faint">Cà phê, trà sữa, bia…</span>
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter lead={`${places.length} địa điểm · ${available.length} thành phố`} />
    </PageShell>
  );
}
