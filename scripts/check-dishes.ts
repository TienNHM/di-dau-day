import { getPlaceRepository } from '../src/lib/places/static-repository';
import { toPlaceSummary } from '../src/lib/places/types';
import { DISHES } from '../src/lib/dishes/catalogue';
import { availableDishes, placesForDish } from '../src/lib/dishes/match';
import { MIN_PLACES_PER_DISH } from '../src/lib/dishes/types';

/**
 * How many dishes each city can actually answer for.
 *
 *   pnpm data:dishes
 *
 * A dish nobody is ever offered looks exactly like a dish nobody picks, so this is
 * the only way to see whether the catalogue is doing anything. Run it after changing
 * `data/dishes.json` or re-importing places.
 */
async function main() {
  const repo = getPlaceRepository();
  const cities = await repo.listCities();

  console.log(`Ngưỡng: ${MIN_PLACES_PER_DISH} địa điểm mỗi món.\n`);
  console.log('thành phố'.padEnd(14), 'món ăn'.padStart(8), 'đồ uống'.padStart(9));

  const everOffered = new Set<string>();

  for (const city of cities) {
    const places = (await repo.listPlaces({ cityId: city.id })).map(toPlaceSummary);
    const available = availableDishes(places, DISHES);
    for (const match of available) everOffered.add(match.dish.id);

    const food = available.filter((match) => match.dish.kind === 'mon-an').length;
    const drink = available.filter((match) => match.dish.kind === 'do-uong').length;
    console.log(city.id.padEnd(14), String(food).padStart(8), String(drink).padStart(9));
  }

  const all = (await repo.listPlaces()).map(toPlaceSummary);
  console.log('\nToàn quốc, số địa điểm mỗi món:');
  for (const dish of DISHES) {
    const count = placesForDish(all, dish).length;
    const flag = everOffered.has(dish.id) ? ' ' : '✗';
    console.log(` ${flag} ${dish.name.padEnd(18)} ${String(count).padStart(5)}`);
  }

  const never = DISHES.filter((dish) => !everOffered.has(dish.id));
  if (never.length > 0) {
    console.log(
      `\n⚠ ${never.length} món không thành phố nào đủ điều kiện: ${never.map((d) => d.name).join(', ')}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
