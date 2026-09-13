import { MIN_PLACES_PER_DISH } from './types';
import type { Dish, DishMatch } from './types';
import type { PlaceSummary } from '@/lib/places/types';

/**
 * Which places can answer "where do I eat this".
 *
 * Two signals, and the order matters. Overture's own subcategory is a fact about the
 * place and is taken at face value. The name is an inference — a strong one here,
 * because Vietnamese places are so often named after what they sell — but an
 * inference, so it is the one that carries exclusions.
 */

/**
 * Whole-word containment on the accented string.
 *
 * `includes` alone matches "pho" inside "phong"; stripping accents first is worse
 * still, because it makes "Phở" and "Phố" the same word and turns "Phố ốc Vĩnh Khánh"
 * into a phở restaurant. Eighteen of thirty-three matches were wrong that way.
 */
export function hasWord(haystack: string, needle: string): boolean {
  const letter = /[\p{L}\p{N}]/u;
  let from = 0;

  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;

    const before = at === 0 ? ' ' : haystack[at - 1]!;
    const after = haystack[at + needle.length] ?? ' ';
    if (!letter.test(before) && !letter.test(after)) return true;

    from = at + 1;
  }
}

export function matchesDish(place: PlaceSummary, dish: Dish): boolean {
  if (place.subCategory && dish.subCategories.includes(place.subCategory)) return true;

  const name = place.name.toLowerCase();
  if (dish.nameExcludes?.some((term) => name.includes(term))) return false;
  return dish.nameAliases.some((alias) => hasWord(name, alias));
}

export function placesForDish(places: readonly PlaceSummary[], dish: Dish): readonly PlaceSummary[] {
  return places
    .filter((place) => matchesDish(place, dish))
    // Most likely to be worth going to first. The result page shows a list, not one
    // pick, so this is an ordering rather than a choice.
    .sort((a, b) => b.popularity - a.popularity);
}

/**
 * The dishes a city can actually answer for.
 *
 * A dish with two places behind it is a dead end dressed up as a suggestion, so the
 * spinner is only ever offered choices it can follow through on. This also means a
 * smaller city offers a shorter, honest menu rather than the same list with holes.
 */
export function availableDishes(
  places: readonly PlaceSummary[],
  dishes: readonly Dish[],
  minPlaces: number = MIN_PLACES_PER_DISH,
): readonly DishMatch[] {
  return dishes
    .map((dish) => ({ dish, places: placesForDish(places, dish) }))
    .filter((match) => match.places.length >= minPlaces);
}
