import type { PlaceSummary } from '@/lib/places/types';

/**
 * A dish or drink the wizard can suggest.
 *
 * There is no menu data anywhere — not in Overture, not anywhere open — so a dish is
 * linked to places by two signals, in order of how much they can be trusted:
 *
 * 1. **`subCategories`** — Overture's own classification, carried through the import
 *    as `subCategory`. `seafood_restaurant` is a fact about the place, not a guess.
 * 2. **`nameAliases`** — matched against the place's name, which in Vietnam is very
 *    often the dish itself: Phở Lệ, Cơm Tấm Ba Ghiền, Bánh Xèo 46A. This is the only
 *    way to reach the specifically Vietnamese dishes, which Overture lumps together
 *    as `vietnamese_restaurant`.
 *
 * Matching is done on the accented form. Stripping diacritics collapses "Phở" and
 * "Phố" into one token, which made "Phố ốc Vĩnh Khánh" a phở restaurant — 18 of 33
 * matches were wrong that way. ASCII spellings are listed as separate aliases
 * instead, so "Bun Bo Chu Ha" still matches without the ambiguity.
 */
export const DISH_KINDS = ['mon-an', 'do-uong'] as const;
export type DishKind = (typeof DISH_KINDS)[number];

export type Dish = {
  readonly id: string;
  readonly kind: DishKind;
  readonly name: string;
  readonly emoji: string;
  /** One line, in the product's voice. Shown on the result and in the share image. */
  readonly note: string;
  /** Overture subcategory slugs that always mean this dish. */
  readonly subCategories: readonly string[];
  /** Lowercase, accented where it matters. Matched as whole words against the name. */
  readonly nameAliases: readonly string[];
  /**
   * Substrings that disqualify a name match.
   *
   * "Phá lấu" is not "lẩu" and "Bánh kem" is not "kem". These are never applied to a
   * subcategory match, which comes from the data rather than from a guess.
   */
  readonly nameExcludes?: readonly string[];
};

/** Below this a dish is not offered in a city at all: a result with two options is a dead end. */
export const MIN_PLACES_PER_DISH = 3;

export type DishMatch = {
  readonly dish: Dish;
  readonly places: readonly PlaceSummary[];
};
