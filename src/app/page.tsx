import type { Metadata } from 'next';
import Link from 'next/link';
import { CityPicker } from '@/components/city/CityPicker';
import { IntentCard } from '@/components/intent/IntentCard';
import { PageShell } from '@/components/ui/PageShell';
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
      </main>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-6 text-sm text-ink-faint">
        <span>
          {places.length} địa điểm · {available.length} thành phố
        </span>
        <span aria-hidden>·</span>
        <Link className="underline-offset-4 hover:text-ink hover:underline" href="/ve-chung-toi">
          Về tụi mình
        </Link>
        <Link className="underline-offset-4 hover:text-ink hover:underline" href="/dong-gop">
          Gợi ý địa điểm
        </Link>
      </footer>
    </PageShell>
  );
}
