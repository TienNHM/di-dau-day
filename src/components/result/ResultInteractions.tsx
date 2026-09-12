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
  canonicalPath,
  directionsHref,
  siteUrl,
}: {
  placeSlug: string;
  placeName: string;
  canonicalPath: string;
  directionsHref: string;
  siteUrl: string;
}) {
  const searchParams = useSearchParams();

  const { rerollHref, shareUrl } = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    const intent = getIntent(params.get('tu') ?? '') ?? INTENTS.find((i) => i.id === 'di-dau');

    const rerollParams = new URLSearchParams(params);
    rerollParams.delete('tu');
    rerollParams.set('spin', '1');

    return {
      rerollHref: `${intent?.path ?? '/di-dau'}/?${rerollParams.toString()}`,
      // Share the canonical URL without wizard answers: the recipient is starting
      // their own session, not resuming someone else's.
      shareUrl: `${siteUrl}${canonicalPath}`,
    };
  }, [searchParams, canonicalPath, siteUrl]);

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
