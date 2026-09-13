import rawPhotos from '@data/dish-photos.json';
import { BASE_PATH } from '@/lib/site';

/**
 * The photograph for a dish, when there is one.
 *
 * The list is empty until `pnpm data:photos` has been run with a Pexels key, and the
 * UI is built to work either way: a dish without a photo keeps the emoji-on-gradient
 * treatment the whole product already uses. That is deliberate rather than a stopgap
 * — it is what the place cards look like, so a missing photo reads as the house style
 * rather than as a hole.
 */

export type DishPhoto = {
  readonly dishId: string;
  readonly file: string;
  readonly author: string;
  readonly sourceUrl: string;
};

const BY_DISH = new Map((rawPhotos as DishPhoto[]).map((photo) => [photo.dishId, photo]));

export function dishPhoto(dishId: string): (DishPhoto & { readonly src: string }) | null {
  const photo = BY_DISH.get(dishId);
  return photo ? { ...photo, src: `${BASE_PATH}/dish/${photo.file}` } : null;
}

export function hasDishPhotos(): boolean {
  return BY_DISH.size > 0;
}
