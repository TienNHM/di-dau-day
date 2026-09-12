import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Route } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { accentFor } from '@/lib/intents/accents';
import { getPlaceRepository } from '@/lib/places/static-repository';
import { PRICE_RANGE_LABELS } from '@/lib/places/types';
import type { Category, Place } from '@/lib/places/types';
import { DEFAULT_CITY_ID, SITE_NAME } from '@/lib/site';

/**
 * District landing pages.
 *
 * The spin is the product, but it is not a traffic channel — nobody searches for
 * "random place generator". People search "quán cafe Bình Thạnh". These pages are
 * how that search finds us, and every one of them ends in the same wizard.
 *
 * They cost nothing to serve: same data, same build, one more static page.
 */

const CATEGORY_LABELS: Record<Category, string> = {
  food: 'Ăn uống',
  cafe: 'Cafe',
  entertainment: 'Giải trí',
  outdoor: 'Ngoài trời',
  dating: 'Hẹn hò',
  family: 'Gia đình',
  shopping: 'Mua sắm',
  activity: 'Trải nghiệm',
};

/** Order matters: this is the order the sections appear on the page. */
const CATEGORY_ORDER: readonly Category[] = [
  'food',
  'cafe',
  'outdoor',
  'dating',
  'entertainment',
  'family',
  'activity',
  'shopping',
];

type Params = { district: string };

export async function generateStaticParams(): Promise<Params[]> {
  const repo = getPlaceRepository();
  const [city, places] = await Promise.all([repo.getCity(DEFAULT_CITY_ID), repo.listPlaces()]);

  // Only districts that have places: an empty district page is a thin page that
  // earns a search penalty rather than traffic.
  const populated = new Set(places.map((place) => place.location.districtId));

  return (city?.districts ?? [])
    .filter((district) => populated.has(district.id))
    .map((district) => ({ district: district.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { district: districtId } = await params;
  const repo = getPlaceRepository();

  const [district, places] = await Promise.all([
    repo.getDistrict(DEFAULT_CITY_ID, districtId),
    repo.listPlaces({ districtId }),
  ]);
  if (!district) return {};

  const title = `Đi đâu ở ${district.shortName}?`;
  const description = `${places.length} gợi ý ăn uống, cafe và chỗ đi chơi ở ${district.name}, TP.HCM — chọn giúp bạn trong 15 giây.`;

  return {
    title,
    description,
    alternates: { canonical: `/quan/${district.id}/` },
    openGraph: { title: `${title} · ${SITE_NAME}`, description },
  };
}

export default async function DistrictPage({ params }: { params: Promise<Params> }) {
  const { district: districtId } = await params;

  const repo = getPlaceRepository();
  const [district, places] = await Promise.all([
    repo.getDistrict(DEFAULT_CITY_ID, districtId),
    repo.listPlaces({ districtId }),
  ]);

  if (!district || places.length === 0) notFound();

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    places: places.filter((place) => place.category === category),
  })).filter((group) => group.places.length > 0);

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
            Đi đâu ở {district.shortName}?
          </h1>
          <p className="mt-3 text-ink-soft">
            {places.length} chỗ tụi mình đã chọn lọc ở {district.name}. Không muốn đọc hết thì để
            tụi mình chọn giúp.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-2xl bg-ink px-5 py-3.5 font-bold text-cream transition active:scale-[0.98]"
          >
            🎲 Chọn giúp tôi
          </Link>
        </div>

        {grouped.map((group) => (
          <section key={group.category}>
            <h2 className="text-lg font-bold">{CATEGORY_LABELS[group.category]}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {group.places.map((place) => (
                <li key={place.slug}>
                  <PlaceRow place={place} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </PageShell>
  );
}

function PlaceRow({ place }: { place: Place }) {
  const accent = accentFor(place.category);

  return (
    <Link
      href={`/dia-diem/${place.slug}/` as Route}
      className="flex items-start gap-3.5 rounded-2xl bg-white/70 p-4 ring-1 ring-line transition hover:ring-ink/15"
    >
      <span
        aria-hidden
        className="mt-0.5 size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: accent.from }}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{place.name}</span>
        {place.editorialNote ? (
          <span className="mt-0.5 block text-sm text-ink-soft">{place.editorialNote}</span>
        ) : null}
        <span className="mt-1.5 block text-xs text-ink-faint">
          {PRICE_RANGE_LABELS[place.priceRange]}
        </span>
      </span>
    </Link>
  );
}
