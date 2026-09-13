'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadCityCards, loadCityShard } from './shard-client';
import { SHARD_MANIFEST } from './shard-manifest';
import { directionsUrlTo } from '@/lib/geo/maps-link';
import { CITY_QUERY_KEY } from '@/lib/recommend/criteria';
import { DEFAULT_CITY_ID } from '@/lib/site';
import type { ItineraryCard } from '@/components/itinerary/ItineraryTimeline';

/**
 * The card index for whichever city a plan belongs to.
 *
 * The page used to receive every TP.HCM place as server-rendered props — around
 * 240 KB of HTML to display three stops, and wrong for every other city. It now
 * fetches the two files for one city and joins them in the browser. The place shard
 * is normally already cached from the wizard the visitor just came through, so in
 * practice only the smaller extras file is actually downloaded.
 */

export type ItineraryCardsState = {
  readonly status: 'loading' | 'ready' | 'error';
  readonly cards: readonly ItineraryCard[];
};

const NONE: readonly never[] = [];

/** The city travels with the result, so a stale response cannot be shown as current. */
type Loaded = ItineraryCardsState & { readonly cityId: string };

/**
 * A plan link carries its city in `?tp=`.
 *
 * Links shared before that parameter existed have none, and every one of them was
 * made in TP.HCM — back then the wizard served no other city. So the fallback is the
 * default city, deliberately *not* the visitor's own: someone in Hà Nội opening an
 * old TP.HCM plan would otherwise have its slugs looked up in the Hà Nội shard, find
 * none of them, and be told the link is broken when it is not.
 */
function useCityForPlan(): string {
  const params = useSearchParams();
  const requested = params.get(CITY_QUERY_KEY);
  return requested && requested in SHARD_MANIFEST ? requested : DEFAULT_CITY_ID;
}

export function useItineraryCards(): ItineraryCardsState {
  const cityId = useCityForPlan();
  const [state, setState] = useState<Loaded>({ cityId, status: 'loading', cards: NONE });

  // Adjusted during render rather than in an effect, so switching cities never
  // paints one frame of the previous city's cards. See `useCityShard`.
  if (state.cityId !== cityId) {
    setState({ cityId, status: 'loading', cards: NONE });
  }

  useEffect(() => {
    let active = true;

    Promise.all([loadCityShard(cityId), loadCityCards(cityId)])
      .then(([shard, cards]) => {
        if (!active) return;

        const districtNames = new Map(shard.districts.map((d) => [d.id, d.shortName]));
        const extras = new Map(cards.extras.map((extra) => [extra.slug, extra]));

        const joined: ItineraryCard[] = shard.places.flatMap((place) => {
          const extra = extras.get(place.slug);
          // A place with no matching extra means the two files disagree, which can
          // only happen mid-deploy. Dropping it is better than a card with a blank
          // address where the address is the point.
          if (!extra) return [];

          return [
            {
              slug: place.slug,
              name: place.name,
              category: place.category,
              districtName: districtNames.get(place.districtId) ?? null,
              address: extra.address,
              lat: place.lat,
              lng: place.lng,
              ...(place.avgPrice === undefined ? {} : { avgPrice: place.avgPrice }),
              ...(place.durationMinutes === undefined
                ? {}
                : { durationMinutes: place.durationMinutes }),
              ...(extra.note === undefined ? {} : { editorialNote: extra.note }),
              directionsUrl: directionsUrlTo({
                lat: place.lat,
                lng: place.lng,
                ...(extra.mapsPlaceId === undefined ? {} : { placeId: extra.mapsPlaceId }),
              }),
            },
          ];
        });

        setState({ cityId, status: 'ready', cards: joined });
      })
      .catch(() => {
        if (active) setState({ cityId, status: 'error', cards: NONE });
      });

    return () => {
      active = false;
    };
  }, [cityId]);

  // A response for a city we have since moved away from must not be shown.
  return state.cityId === cityId ? state : { status: 'loading', cards: NONE };
}
