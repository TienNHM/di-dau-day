import { describe, expect, it } from 'vitest';
import { getPlaceRepository } from './static-repository';
import { DEFAULT_CITY_ID } from '@/lib/site';
import { toPlaceSummary } from './types';

/**
 * Data-integrity tests. These run against the real seed data, so they are the
 * safety net that catches a bad hand-edited record before it reaches a build.
 */
describe('seed data', () => {
  const repo = getPlaceRepository();

  it('loads the default city with unique districts', async () => {
    const city = await repo.getCity(DEFAULT_CITY_ID);
    expect(city).not.toBeNull();

    const ids = city!.districts.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('parses every place file without throwing', async () => {
    await expect(repo.listPlaces()).resolves.toBeInstanceOf(Array);
  });

  it('returns only active places from listPlaces', async () => {
    const places = await repo.listPlaces();
    expect(places.every((p) => p.status === 'active')).toBe(true);
  });

  it('resolves each active place by its own slug', async () => {
    const places = await repo.listPlaces();
    for (const place of places) {
      await expect(repo.getPlaceBySlug(place.slug)).resolves.toMatchObject({ id: place.id });
    }
  });

  it('keeps address, images and editorial copy out of the client summary', async () => {
    const places = await repo.listPlaces();
    for (const place of places) {
      const summary = toPlaceSummary(place);
      expect(summary).not.toHaveProperty('location');
      expect(summary).not.toHaveProperty('images');
      expect(summary).not.toHaveProperty('editorialNote');
      expect(summary.districtId).toBe(place.location.districtId);
    }
  });
});
