import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { ItineraryTimeline } from '@/components/itinerary/ItineraryTimeline';
import { absoluteUrl, SITE_NAME, SITE_URL } from '@/lib/site';

/**
 * One static page that renders any itinerary.
 *
 * The plan lives in the query string, so this page cannot be prerendered per plan —
 * the combinations are unbounded. It used to compensate by baking a card index of
 * every TP.HCM place into the HTML: roughly 240 KB to render three stops, and no
 * help at all to a plan made in Hà Nội. The index is now fetched per city in the
 * browser, which leaves this file a static shell.
 *
 * The share image stays generic: the number of possible plans makes a per-plan OG
 * image impossible without a runtime, which GitHub Pages does not have.
 */

export const metadata: Metadata = {
  title: 'Kế hoạch cho buổi hẹn',
  description: `Cà phê, đi chơi rồi ăn tối — ${SITE_NAME} lên sẵn một buổi tối cho bạn.`,
  alternates: { canonical: absoluteUrl('/lich-trinh/') },
  openGraph: {
    title: `Kế hoạch cho buổi hẹn · ${SITE_NAME}`,
    description: 'Cà phê → đi chơi → ăn tối. Một buổi tối đã được lên sẵn.',
    images: [{ url: absoluteUrl('/og/home.jpg'), width: 1200, height: 630, alt: SITE_NAME }],
  },
  // A plan is a personal link, not a search result — every URL here is the same page.
  robots: { index: false, follow: true },
};

export default function ItineraryPage() {
  return (
    <PageShell>
      <main className="flex flex-1 flex-col py-6">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-cream-deep" />}>
          <ItineraryTimeline siteUrl={SITE_URL} />
        </Suspense>
      </main>
    </PageShell>
  );
}
