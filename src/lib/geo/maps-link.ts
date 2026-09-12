import type { Place } from '@/lib/places/types';

/**
 * Directions deep link.
 *
 * Uses the universal maps URL rather than a native scheme: it opens the Google Maps
 * app when installed and falls back to the browser otherwise, which matters because
 * most traffic here arrives from a shared link inside Zalo or Messenger.
 *
 * `googleMapsPlaceId` is preferred when known — a name search can land on the wrong
 * branch of a chain, and sending someone to the wrong address destroys the trust the
 * whole product depends on.
 */
export function directionsUrl(place: Place): string {
  return directionsUrlTo({
    lat: place.location.lat,
    lng: place.location.lng,
    ...(place.location.googleMapsPlaceId === undefined
      ? {}
      : { placeId: place.location.googleMapsPlaceId }),
  });
}

/**
 * The same link built from coordinates alone.
 *
 * The itinerary page assembles its cards in the browser from a shard, which carries
 * coordinates but not a whole `Place`. The place id is passed separately and stays
 * optional — but it is worth carrying: without it a name search can land on the
 * wrong branch of a chain.
 */
export function directionsUrlTo({
  lat,
  lng,
  placeId,
}: {
  lat: number;
  lng: number;
  placeId?: string;
}): string {
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lng}` });
  if (placeId) params.set('destination_place_id', placeId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Link to the place itself rather than a route — used for "xem trên bản đồ". */
export function mapsPlaceUrl(place: Place): string {
  const params = new URLSearchParams({
    api: '1',
    query: `${place.location.lat},${place.location.lng}`,
  });

  if (place.location.googleMapsPlaceId) {
    params.set('query_place_id', place.location.googleMapsPlaceId);
  }

  return `https://www.google.com/maps/search/?${params.toString()}`;
}
