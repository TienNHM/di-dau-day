import type { MetadataRoute } from 'next';
import { INTENTS } from '@/lib/intents/registry';
import { getPlaceRepository } from '@/lib/places/static-repository';
import { absoluteUrl } from '@/lib/site';

/**
 * Static sitemap, generated at build.
 *
 * Place and district pages are the whole SEO surface — the wizard itself is not
 * searchable and does not try to be. `lastModified` comes from each place's
 * `updatedAt`, so a crawler re-fetches a page only when its data actually changed.
 */
export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repo = getPlaceRepository();
  const [cities, places] = await Promise.all([repo.listCities(), repo.listPlaces()]);

  const populatedCities = new Set(places.map((place) => place.location.cityId));
  const populatedDistricts = new Set(
    places.map((place) => `${place.location.cityId}/${place.location.districtId}`),
  );

  return [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    ...INTENTS.map((intent) => ({
      url: absoluteUrl(`${intent.path}/`),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...['/ve-chung-toi/', '/dong-gop/'].map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
    ...cities
      .filter((city) => populatedCities.has(city.id))
      .map((city) => ({
        url: absoluteUrl(`/thanh-pho/${city.id}/`),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
    ...[...populatedDistricts].map((key) => ({
      url: absoluteUrl(`/thanh-pho/${key}/`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...places.map((place) => ({
      url: absoluteUrl(`/dia-diem/${place.slug}/`),
      lastModified: new Date(place.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
