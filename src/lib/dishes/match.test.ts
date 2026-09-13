import { describe, expect, it } from 'vitest';
import { availableDishes, hasWord, matchesDish, placesForDish } from './match';
import { DISHES, getDish } from './catalogue';
import type { Dish } from './types';
import type { PlaceSummary } from '@/lib/places/types';

function place(overrides: Partial<PlaceSummary> & { name: string }): PlaceSummary {
  return {
    id: overrides.name,
    slug: overrides.name.toLowerCase().replace(/\s+/g, '-'),
    category: 'food',
    tags: [],
    cityId: 'ho-chi-minh',
    districtId: 'quan-1',
    lat: 10.77,
    lng: 106.7,
    popularity: 50,
    isSponsored: false,
    ...overrides,
  };
}

const dish = (id: string): Dish => {
  const found = getDish(id);
  if (!found) throw new Error(`Không có món "${id}" trong catalogue`);
  return found;
};

describe('hasWord', () => {
  it('matches a whole word', () => {
    expect(hasWord('phở lệ', 'phở')).toBe(true);
  });

  it('does not match inside a longer word', () => {
    // The reason `includes` is not enough: "pho" sits inside "phong".
    expect(hasWord('cafe phong thủy', 'pho')).toBe(false);
  });

  it('treats punctuation as a boundary', () => {
    expect(hasWord('quán phở, cơm', 'phở')).toBe(true);
  });
});

describe('matchesDish', () => {
  it('accepts a place on its Overture subcategory alone', () => {
    // No dish word in the name at all — the classification is what carries it.
    const hit = place({ name: 'Bí Bo', subCategory: 'seafood-restaurant' });
    expect(matchesDish(hit, dish('hai-san'))).toBe(true);
  });

  it('accepts a place on its name when there is no subcategory', () => {
    expect(matchesDish(place({ name: 'Phở Lệ' }), dish('pho'))).toBe(true);
  });

  it('keeps Phố and Phở apart', () => {
    // The bug that made stripping diacritics untenable: "Phố ốc" is a street of snail
    // shops, not a phở restaurant, and the two words differ only by their accent.
    expect(matchesDish(place({ name: 'Phố ốc Vĩnh Khánh' }), dish('pho'))).toBe(false);
    expect(matchesDish(place({ name: 'Phố nướng Hàn Quốc' }), dish('pho'))).toBe(false);
  });

  it('matches names written without accents', () => {
    expect(matchesDish(place({ name: 'Pho Le Nguyen Trai' }), dish('pho'))).toBe(true);
  });

  it('applies exclusions to name matches', () => {
    // "Phá lấu" is a different dish that contains the letters of "lấu".
    expect(matchesDish(place({ name: 'Phá lấu dì Nhiều' }), dish('lau'))).toBe(false);
    expect(matchesDish(place({ name: 'Lẩu dê Trương Định' }), dish('lau'))).toBe(true);
  });

  it('does not let an exclusion override the data', () => {
    // The subcategory is a fact; a name exclusion is a guard on the guess, and must
    // not be able to discard a place Overture has already classified.
    const hit = place({ name: 'Bánh kem Kim Thương', subCategory: 'ice-cream-shop' });
    expect(matchesDish(hit, dish('kem'))).toBe(true);
  });

  it('rejects "bánh kem" when only the name is available', () => {
    expect(matchesDish(place({ name: 'Bánh kem Kim Thương' }), dish('kem'))).toBe(false);
  });
});

describe('placesForDish', () => {
  it('returns the most promising first', () => {
    const places = [
      place({ name: 'Phở B', popularity: 40 }),
      place({ name: 'Phở A', popularity: 90 }),
      place({ name: 'Bún chả C', popularity: 99 }),
    ];
    expect(placesForDish(places, dish('pho')).map((p) => p.name)).toEqual(['Phở A', 'Phở B']);
  });
});

describe('availableDishes', () => {
  it('drops a dish that cannot be followed through on', () => {
    // One phở place is not an answer to "where do I eat phở", it is a dead end.
    const places = [place({ name: 'Phở Lệ' })];
    expect(availableDishes(places, DISHES)).toHaveLength(0);
  });

  it('keeps a dish once it has enough places', () => {
    const places = [
      place({ name: 'Phở Lệ' }),
      place({ name: 'Phở Hòa' }),
      place({ name: 'Phở Thìn' }),
    ];
    const available = availableDishes(places, DISHES);
    expect(available.map((match) => match.dish.id)).toContain('pho');
  });
});

describe('catalogue', () => {
  it('has both a food and a drink side', () => {
    expect(DISHES.some((entry) => entry.kind === 'mon-an')).toBe(true);
    expect(DISHES.some((entry) => entry.kind === 'do-uong')).toBe(true);
  });

  it('never points two dishes at the same subcategory', () => {
    // A shared subcategory would make two dishes return identical place lists, and
    // the reel would be offering the same answer under two names.
    const owner = new Map<string, string>();
    for (const entry of DISHES) {
      for (const sub of entry.subCategories) {
        const existing = owner.get(sub);
        expect(existing, `${sub}: ${existing} và ${entry.id}`).toBeUndefined();
        owner.set(sub, entry.id);
      }
    }
  });
});
