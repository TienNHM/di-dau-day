import { z } from 'zod';
import rawDishes from '@data/dishes.json';
import { DISH_KINDS } from './types';
import type { Dish, DishKind } from './types';

/**
 * The dish catalogue, validated once at module load.
 *
 * Same contract as the place data: a malformed entry fails the build rather than
 * quietly never matching anything, which is the failure mode that would be hardest
 * to notice — a dish nobody is ever offered looks exactly like a dish nobody picks.
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'phải là slug dạng a-z0-9 và dấu gạch ngang');

const dishSchema = z.object({
  id: slug,
  kind: z.enum(DISH_KINDS),
  name: z.string().min(1).max(40),
  emoji: z.string().min(1).max(8),
  note: z.string().min(10).max(160),
  subCategories: z.array(slug).readonly(),
  // Accents are meaningful here, so this is not a slug — but it must be lowercase,
  // because matching lowercases the place name and never the alias.
  nameAliases: z
    .array(z.string().min(2).max(40).refine((value) => value === value.toLowerCase(), 'alias phải viết thường'))
    .min(1)
    .readonly(),
  nameExcludes: z.array(z.string().min(2).max(40)).readonly().optional(),
});

function parse(): readonly Dish[] {
  const result = z.array(dishSchema).safeParse(rawDishes);
  if (!result.success) {
    throw new Error(`data/dishes.json không hợp lệ:\n${z.prettifyError(result.error)}`);
  }

  const dishes = result.data as Dish[];

  const seen = new Set<string>();
  for (const dish of dishes) {
    if (seen.has(dish.id)) throw new Error(`Món "${dish.id}" bị trùng id trong data/dishes.json`);
    seen.add(dish.id);

    // A dish with neither signal can never match a place, which would be a silent
    // dead entry rather than an error.
    if (dish.subCategories.length === 0 && dish.nameAliases.length === 0) {
      throw new Error(`Món "${dish.id}" không có subCategories lẫn nameAliases`);
    }
  }

  return dishes;
}

export const DISHES: readonly Dish[] = parse();

export function dishesOfKind(kind: DishKind): readonly Dish[] {
  return DISHES.filter((dish) => dish.kind === kind);
}

export function getDish(id: string): Dish | null {
  return DISHES.find((dish) => dish.id === id) ?? null;
}
