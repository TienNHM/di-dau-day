'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResultActions } from './ResultActions';
import { getIntent, INTENTS } from '@/lib/intents/registry';
import { track } from '@/lib/analytics/track';

/**
 * Reads the wizard context out of the URL.
 *
 * The page itself is fully static — it has to be, on GitHub Pages — so anything that
 * depends on query parameters is read here, after hydration. That also means a shared
 * link with no parameters still renders a complete, correct page.
 */
export function ResultInteractions({
  placeSlug,
  placeName,
  shareUrl,
  directionsHref,
}: {
  placeSlug: string;
  placeName: string;
  /** Absolute, and already basePath-aware — built on the server by absoluteUrl(). */
  shareUrl: string;
  directionsHref: string;
}) {
  const searchParams = useSearchParams();

  const rerollHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    const intent = getIntent(params.get('tu') ?? '') ?? INTENTS.find((i) => i.id === 'di-dau');

    const rerollParams = new URLSearchParams(params);
    rerollParams.delete('tu');
    rerollParams.set('spin', '1');

    return `${intent?.path ?? '/di-dau'}/?${rerollParams.toString()}`;
  }, [searchParams]);

  useEffect(() => {
    track('result_view', { place: placeSlug });
  }, [placeSlug]);

  return (
    <ResultActions
      directionsHref={directionsHref}
      shareUrl={shareUrl}
      shareText={`Đi Đâu Đây vừa chọn: ${placeName}`}
      rerollHref={rerollHref}
      placeSlug={placeSlug}
    />
  );
}
