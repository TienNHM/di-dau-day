import { z } from 'zod';
import { CATEGORIES, COMPANIONS, PRICE_RANGES, TAGS } from './types';
import type { City, Place } from './types';

/**
 * Runtime validation for seed data.
 *
 * Seed data is hand-curated, so it will contain typos. Validating at build time
 * turns a typo into a failed build with a path like `places[12].tags[0]`, instead
 * of a place that silently never matches any filter.
 */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeRangeSchema = z
  .tuple([z.string().regex(TIME, 'Giờ phải có dạng HH:mm'), z.string().regex(TIME, 'Giờ phải có dạng HH:mm')])
  .readonly();

const dayScheduleSchema = z.array(timeRangeSchema).readonly();

export const openingHoursSchema = z
  .object({
    default: dayScheduleSchema.optional(),
    mon: dayScheduleSchema.optional(),
    tue: dayScheduleSchema.optional(),
    wed: dayScheduleSchema.optional(),
    thu: dayScheduleSchema.optional(),
    fri: dayScheduleSchema.optional(),
    sat: dayScheduleSchema.optional(),
    sun: dayScheduleSchema.optional(),
    note: z.string().optional(),
  })
  .strict();

const slugSchema = z
  .string()
  .min(2)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang');

export const placeSchema = z
  .object({
    id: slugSchema,
    slug: slugSchema,
    name: z.string().min(2),
    shortName: z.string().min(1).optional(),
    category: z.enum(CATEGORIES),
    subCategory: slugSchema.optional(),
    tags: z.array(z.enum(TAGS)).readonly(),
    goodFor: z.array(z.enum(COMPANIONS)).min(1).readonly().optional(),
    priceRange: z.enum(PRICE_RANGES).optional(),
    avgPrice: z.number().int().nonnegative().optional(),
    durationMinutes: z
      .tuple([z.number().int().positive(), z.number().int().positive()])
      .refine(([min, max]) => min <= max, 'durationMinutes phải là [min, max]')
      .readonly()
      .optional(),
    location: z
      .object({
        cityId: slugSchema,
        districtId: slugSchema,
        address: z.string().min(4),
        // Bounds cover the whole country, so a swapped lat/lng fails the build.
        lat: z.number().min(8).max(24),
        lng: z.number().min(101).max(110),
        googleMapsPlaceId: z.string().min(4).optional(),
      })
      .strict(),
    openingHours: openingHoursSchema.optional(),
    rating: z.number().min(0).max(5).optional(),
    ratingSource: z.string().optional(),
    images: z
      .array(
        z
          .object({
            url: z.string().min(1),
            alt: z.string().min(1),
            credit: z.string().optional(),
          })
          .strict(),
      )
      .readonly()
      .default([]),
    popularity: z.number().int().min(0).max(100),
    editorialNote: z.string().min(10).max(200).optional(),
    sponsored: z
      .object({
        until: z.iso.date(),
        label: z.string().min(2),
      })
      .strict()
      .optional(),
    affiliate: z
      .array(
        z
          .object({
            provider: z.string().min(1),
            url: z.url(),
            label: z.string().min(1),
          })
          .strict(),
      )
      .readonly()
      .optional(),
    status: z.enum(['active', 'hidden', 'closed']),
    updatedAt: z.iso.date(),
  })
  .strict();

export const districtSchema = z
  .object({
    id: slugSchema,
    name: z.string().min(2),
    shortName: z.string().min(2),
    lat: z.number().min(8).max(24),
    lng: z.number().min(101).max(110),
  })
  .strict();

export const citySchema = z
  .object({
    id: slugSchema,
    name: z.string().min(2),
    shortName: z.string().min(2),
    slug: slugSchema,
    lat: z.number().min(8).max(24),
    lng: z.number().min(101).max(110),
    districts: z.array(districtSchema).min(1).readonly(),
  })
  .strict();

/**
 * Validates a batch of places and additionally enforces cross-record invariants
 * that a per-record schema cannot see: unique ids and slugs (a duplicate slug
 * would make two places fight over one URL), and city/district references that
 * actually exist.
 *
 * District ids are only unique within a city, so the district is checked against
 * the city the place claims — not against a global list, which would let a place in
 * Đà Nẵng pass by matching a district id that happens to exist in TP.HCM.
 */
export function parsePlaces(raw: unknown, source: string, cities: readonly City[]): Place[] {
  const result = z.array(placeSchema).safeParse(raw);
  if (!result.success) {
    throw new Error(`Dữ liệu địa điểm không hợp lệ trong ${source}:\n${z.prettifyError(result.error)}`);
  }

  const places = result.data as Place[];
  const byCityId = new Map(cities.map((city) => [city.id, city]));
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const place of places) {
    if (seenIds.has(place.id)) throw new Error(`Trùng id "${place.id}" trong ${source}`);
    if (seenSlugs.has(place.slug)) throw new Error(`Trùng slug "${place.slug}" trong ${source}`);
    seenIds.add(place.id);
    seenSlugs.add(place.slug);

    const city = byCityId.get(place.location.cityId);
    if (!city) {
      throw new Error(
        `Địa điểm "${place.slug}" thuộc thành phố "${place.location.cityId}" không có trong data/cities/`,
      );
    }

    if (!city.districts.some((district) => district.id === place.location.districtId)) {
      throw new Error(
        `Địa điểm "${place.slug}" thuộc quận "${place.location.districtId}" không có trong danh sách quận của ${city.name}`,
      );
    }
  }

  return places;
}

export function parseCity(raw: unknown, source: string): City {
  const result = citySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Dữ liệu thành phố không hợp lệ trong ${source}:\n${z.prettifyError(result.error)}`);
  }
  return result.data as City;
}
