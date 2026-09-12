'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCityPreference } from './city-preference';
import { loadCityShard } from './shard-client';
import type { CityShard } from './shard';
import type { Category, District, PlaceSummary } from './types';

/**
 * The visitor's city, loaded on demand.
 *
 * The wizard used to receive TP.HCM's places as server-rendered props regardless of
 * who was asking, which made the city picker decorative: choosing Hà Nội changed the
 * label and nothing else. Loading in the browser is what lets the stored preference
 * actually decide the answer — and it is only affordable because the data is sharded
 * per city, so picking a city costs one 60 KB request that is then cached for good.
 */

export type CityShardState =
  | { readonly status: 'loading'; readonly places: readonly PlaceSummary[]; readonly districts: readonly District[] }
  | { readonly status: 'ready'; readonly places: readonly PlaceSummary[]; readonly districts: readonly District[] }
  | { readonly status: 'error'; readonly places: readonly PlaceSummary[]; readonly districts: readonly District[] };

const NONE: readonly never[] = [];

/** The city is stored with its result, so a stale response cannot be mistaken for the current one. */
type Loaded = { readonly cityId: string; readonly shard: CityShard | null; readonly failed: boolean };

export function useCityShard(categories?: readonly Category[]): CityShardState & { readonly cityId: string } {
  const cityId = useCityPreference();
  const [state, setState] = useState<Loaded>({ cityId, shard: null, failed: false });

  // Reset during render rather than in an effect. Doing it in an effect would leave
  // one render showing the previous city's places under a "loading" label; React
  // handles a state adjustment made here by re-rendering before anything is painted.
  if (state.cityId !== cityId) {
    setState({ cityId, shard: null, failed: false });
  }

  useEffect(() => {
    let active = true;

    loadCityShard(cityId)
      .then((loaded) => {
        if (active) setState({ cityId, shard: loaded, failed: false });
      })
      .catch(() => {
        if (active) setState({ cityId, shard: null, failed: true });
      });

    return () => {
      active = false;
    };
  }, [cityId]);

  const shard = state.cityId === cityId ? state.shard : null;
  const failed = state.cityId === cityId && state.failed;

  // Category filtering is what the intent needs and the shard does not know about,
  // so it happens here rather than in the file — one file per city serves all five
  // intents, which is the point.
  const places = useMemo(() => {
    if (!shard) return NONE;
    if (!categories || categories.length === 0) return shard.places;
    const wanted = new Set(categories);
    return shard.places.filter((place) => wanted.has(place.category));
  }, [shard, categories]);

  const districts = useMemo(() => {
    if (!shard) return NONE;
    // A district with none of *this intent's* places is still a dead end, even
    // though the shard lists it as having places of some kind.
    const withPlaces = new Set(places.map((place) => place.districtId));
    return shard.districts.filter((district) => withPlaces.has(district.id));
  }, [shard, places]);

  const status = shard ? 'ready' : failed ? 'error' : 'loading';
  return { status, places, districts, cityId };
}
