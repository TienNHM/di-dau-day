import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { IntentWizard } from './IntentWizard';
import { getIntent } from '@/lib/intents/registry';
import type { IntentId } from '@/lib/intents/registry';
import { getPlaceRepository } from '@/lib/places/static-repository';
import { toPlaceSummary } from '@/lib/places/types';
import { DEFAULT_CITY_ID } from '@/lib/site';

/**
 * Server half of a wizard route: loads exactly the data this intent needs and hands
 * it to the client component as props.
 *
 * Only this intent's categories are serialised, and only as summaries, so the payload
 * a phone downloads stays proportional to the one question being asked — the full
 * catalogue never ships to the browser.
 */
export async function WizardScreen({ intentId }: { intentId: IntentId }) {
  const intent = getIntent(intentId);
  if (!intent) notFound();

  const repo = getPlaceRepository();
  const [city, places] = await Promise.all([
    repo.getCity(DEFAULT_CITY_ID),
    repo.listPlaces({ cityId: DEFAULT_CITY_ID, categories: intent.categories }),
  ]);

  const summaries = places.map(toPlaceSummary);
  const withPlaces = new Set(summaries.map((place) => place.districtId));

  // Offering a district with no places for this intent would be a guaranteed
  // dead end, so the list is narrowed to districts that can actually answer.
  const districts = (city?.districts ?? []).filter((district) => withPlaces.has(district.id));

  return (
    <Suspense fallback={<WizardSkeleton />}>
      <IntentWizard intent={intent} places={summaries} districts={districts} />
    </Suspense>
  );
}

function WizardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 pt-16" aria-hidden>
      <div className="h-9 w-2/3 animate-pulse rounded-xl bg-cream-deep" />
      <div className="mt-4 h-16 animate-pulse rounded-2xl bg-cream-deep" />
      <div className="h-16 animate-pulse rounded-2xl bg-cream-deep" />
      <div className="h-16 animate-pulse rounded-2xl bg-cream-deep" />
    </div>
  );
}
