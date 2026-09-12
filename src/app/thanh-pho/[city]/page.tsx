import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Route } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { getPlaceRepository } from '@/lib/places/static-repository';
import { absoluteUrl, SITE_NAME } from '@/lib/site';

/**
 * City landing page.
 *
 * The URL carries the city because district ids are only unique within one —
 * "quan-1" is meaningful in TP.HCM and meaningless elsewhere. It also reads the way
 * people search: "đi đâu ở Đà Nẵng", not "đi đâu ở quận Hải Châu".
 */

type Params = { city: string };

export async function generateStaticParams(): Promise<Params[]> {
  const repo = getPlaceRepository();
  const [cities, places] = await Promise.all([repo.listCities(), repo.listPlaces()]);

  // A city with no places is a dead end, and an empty page is a search penalty
  // rather than traffic.
  const populated = new Set(places.map((place) => place.location.cityId));
  return cities.filter((city) => populated.has(city.id)).map((city) => ({ city: city.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city: cityId } = await params;
  const repo = getPlaceRepository();
  const [city, places] = await Promise.all([repo.getCity(cityId), repo.listPlaces({ cityId })]);
  if (!city) return {};

  const title = `Đi đâu ở ${city.shortName}?`;
  const description = `${places.length} gợi ý ăn uống, cafe và chỗ đi chơi ở ${city.name} — tụi mình chọn giúp bạn trong 15 giây.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/thanh-pho/${city.id}/`) },
    openGraph: { title: `${title} · ${SITE_NAME}`, description },
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const { city: cityId } = await params;
  const repo = getPlaceRepository();
  const [city, places] = await Promise.all([repo.getCity(cityId), repo.listPlaces({ cityId })]);

  if (!city || places.length === 0) notFound();

  const counts = new Map<string, number>();
  for (const place of places) {
    counts.set(place.location.districtId, (counts.get(place.location.districtId) ?? 0) + 1);
  }

  const districts = city.districts
    .map((district) => ({ district, count: counts.get(district.id) ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <PageShell>
      <main className="flex flex-1 flex-col gap-8 py-4">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-ink-faint underline-offset-4 hover:text-ink hover:underline"
          >
            ← {SITE_NAME}
          </Link>

          <h1 className="mt-5 text-4xl leading-tight font-extrabold tracking-tight text-balance">
            Đi đâu ở {city.shortName}?
          </h1>
          <p className="mt-3 text-ink-soft">
            {places.length} chỗ ở {city.name}. Không muốn đọc hết thì để tụi mình chọn giúp.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-2xl bg-ink px-5 py-3.5 font-bold text-cream transition active:scale-[0.98]"
          >
            🎲 Chọn giúp tôi
          </Link>
        </div>

        <section>
          <h2 className="text-lg font-bold">Theo khu vực</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {districts.map(({ district, count }) => (
              <li key={district.id}>
                <Link
                  href={`/thanh-pho/${city.id}/${district.id}/` as Route}
                  className="flex h-full items-center justify-between gap-2 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-line transition hover:ring-ink/15"
                >
                  <span className="min-w-0 truncate font-semibold">{district.shortName}</span>
                  <span className="shrink-0 text-sm text-ink-faint">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </PageShell>
  );
}
