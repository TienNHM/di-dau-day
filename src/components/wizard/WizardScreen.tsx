import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { IntentWizard } from './IntentWizard';
import { getIntent } from '@/lib/intents/registry';
import type { IntentId } from '@/lib/intents/registry';

/**
 * Server half of a wizard route.
 *
 * It no longer ships any places. It used to serialise TP.HCM's summaries for the
 * intent into the HTML, which had two problems: the payload was in the critical path
 * of the first paint even though the first two questions need no data, and the city
 * was fixed at build time, so the city picker could not change the answer.
 *
 * The wizard now fetches its city's shard in the browser while the visitor answers.
 * All this component decides is which intent is being asked about.
 */
export function WizardScreen({ intentId }: { intentId: IntentId }) {
  const intent = getIntent(intentId);
  if (!intent) notFound();

  return (
    <Suspense fallback={<WizardSkeleton />}>
      <IntentWizard intent={intent} />
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
