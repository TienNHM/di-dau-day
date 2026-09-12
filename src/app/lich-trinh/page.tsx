import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { ItineraryTimeline } from '@/components/itinerary/ItineraryTimeline';
import type { ItineraryCard } from '@/components/itinerary/ItineraryTimeline';
import { getPlaceRepository } from '@/lib/places/static-repository';
import { directionsUrl } from '@/lib/geo/maps-link';
import { absoluteUrl, DEFAULT_CITY_ID, SITE_NAME, SITE_URL } from '@/lib/site';

/**
 * One static page that renders any itinerary.
 *
 * The plan lives in the query string, so this page cannot be prerendered per plan —
 * the combinations are unbounded. Instead it ships a card index of every place and
 * resolves the stops client-side. That keeps the URL shareable with no server, at
 * the cost of a generic share image: the number of possible plans makes a
 * per-plan OG image impossible without a runtime, which GitHub Pages does not have.
 */

export const metadata: Metadata = {
  title: 'Kế hoạch cho buổi hẹn',
  description: `Cà phê, đi chơi rồi ăn tối — ${SITE_NAME} lên sẵn một buổi tối ở TP.HCM cho bạn.`,
  alternates: { canonical: absoluteUrl('/lich-trinh/') },
  openGraph: {
    title: `Kế hoạch cho buổi hẹn · ${SITE_NAME}`,
    description: 'Cà phê → đi chơi → ăn tối. Một buổi tối đã được lên sẵn.',
    images: [{ url: absoluteUrl('/og/home.png'), width: 1200, height: 630, alt: SITE_NAME }],
  },
  // A plan is a personal link, not a search result — every URL here is the same page.
  robots: { index: false, follow: true },
};

export default async function ItineraryPage() {
  const repo = getPlaceRepository();
  const [city, places] = await Promise.all([
    repo.getCity(DEFAULT_CITY_ID),
    repo.listPlaces({ cityId: DEFAULT_CITY_ID }),
  ]);

  const districtNames = new Map((city?.districts ?? []).map((d) => [d.id, d.shortName]));

  const cards: ItineraryCard[] = places.map((place) => ({
    slug: place.slug,
    name: place.name,
    category: place.category,
    districtName: districtNames.get(place.location.districtId) ?? null,
    address: place.location.address,
    ...(place.avgPrice === undefined ? {} : { avgPrice: place.avgPrice }),
    ...(place.durationMinutes === undefined ? {} : { durationMinutes: place.durationMinutes }),
    ...(place.editorialNote === undefined ? {} : { editorialNote: place.editorialNote }),
    directionsUrl: directionsUrl(place),
  }));

  return (
    <PageShell>
      <main className="flex flex-1 flex-col py-6">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-cream-deep" />}>
          <ItineraryTimeline cards={cards} siteUrl={SITE_URL} />
        </Suspense>
      </main>
    </PageShell>
  );
}
