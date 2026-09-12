import { TAG_LABELS } from './types';
import type { Category, District, Place } from './types';

/**
 * Says what a place is, using only what is actually on record.
 *
 * Most imported places have no editorial note, no price and no opening hours — the
 * three fields no open dataset carries. A card that simply omits them reads as
 * broken; a card that invents them is worse. This builds an honest line out of the
 * facts we do have, so the result still tells the user something before they tap.
 */

const CATEGORY_NOUNS: Record<Category, string> = {
  food: 'Chỗ ăn',
  cafe: 'Quán cà phê',
  entertainment: 'Chỗ giải trí',
  outdoor: 'Ngoài trời',
  dating: 'Chỗ hẹn hò',
  family: 'Hợp gia đình',
  shopping: 'Mua sắm',
  activity: 'Trải nghiệm',
};

/**
 * Overture's sub-category, in Vietnamese.
 *
 * Only the ones that actually appear in the imported data are translated; anything
 * unmapped falls back to the broad category rather than showing a raw English slug,
 * which would look like a bug.
 */
const SUBCATEGORY_NOUNS: Record<string, string> = {
  'vietnamese-restaurant': 'Quán ăn Việt',
  'seafood-restaurant': 'Quán hải sản',
  'japanese-restaurant': 'Quán Nhật',
  'korean-restaurant': 'Quán Hàn',
  'chinese-restaurant': 'Quán Hoa',
  'thai-restaurant': 'Quán Thái',
  'italian-restaurant': 'Quán Ý',
  'pizza-restaurant': 'Pizza',
  'sushi-restaurant': 'Sushi',
  'barbecue-restaurant': 'Quán nướng',
  'chicken-restaurant': 'Quán gà',
  'noodles-restaurant': 'Quán mì',
  'vegetarian-restaurant': 'Quán chay',
  'fast-food-restaurant': 'Đồ ăn nhanh',
  'breakfast-and-brunch-restaurant': 'Quán ăn sáng',
  'asian-restaurant': 'Quán Á',
  diner: 'Quán bình dân',
  'casual-eatery': 'Quán ăn',
  bakery: 'Tiệm bánh',
  'food-truck': 'Xe đồ ăn',
  'ice-cream-shop': 'Quán kem',
  'coffee-shop': 'Quán cà phê',
  cafe: 'Quán cà phê',
  'tea-room': 'Quán trà',
  'bubble-tea': 'Trà sữa',
  'smoothie-juice-bar': 'Quán nước ép',
  'internet-cafe': 'Quán net',
  bar: 'Bar',
  pub: 'Pub',
  'cocktail-bar': 'Cocktail bar',
  'beer-garden': 'Quán bia',
  brewery: 'Nhà máy bia',
  'wine-bar': 'Quán rượu vang',
  'night-club': 'Club',
  cinema: 'Rạp phim',
  karaoke: 'Karaoke',
  'pool-billiards': 'Bi-a',
  bowling: 'Bowling',
  arcade: 'Khu game',
  'escape-game': 'Escape room',
  'music-venue': 'Nhạc sống',
  park: 'Công viên',
  garden: 'Vườn',
  'botanical-garden': 'Vườn thực vật',
  beach: 'Bãi biển',
  lake: 'Hồ',
  'scenic-lookout': 'Điểm ngắm cảnh',
  'hiking-trail': 'Đường mòn',
  museum: 'Bảo tàng',
  'art-gallery': 'Phòng tranh',
  'landmark-and-historical-building': 'Di tích',
  monument: 'Di tích',
  'historic-site': 'Di tích',
  'buddhist-temple': 'Chùa',
  pagoda: 'Chùa',
  shrine: 'Đền',
  'church-cathedral': 'Nhà thờ',
  'amusement-park': 'Công viên giải trí',
  'water-park': 'Công viên nước',
  aquarium: 'Thuỷ cung',
  zoo: 'Vườn thú',
  playground: 'Khu vui chơi',
  gym: 'Phòng gym',
  'yoga-studio': 'Lớp yoga',
  climbing: 'Leo núi',
  'martial-arts': 'Võ đường',
  'dance-school': 'Lớp nhảy',
  'cooking-school': 'Lớp nấu ăn',
  'art-school': 'Lớp vẽ',
  pottery: 'Lớp gốm',
};

export function placeTypeLabel(place: Place): string {
  if (place.subCategory && SUBCATEGORY_NOUNS[place.subCategory]) {
    return SUBCATEGORY_NOUNS[place.subCategory]!;
  }
  return CATEGORY_NOUNS[place.category];
}

/**
 * The one-line summary shown when there is no editorial note.
 *
 * Kept to at most three facts: more than that reads as a spec sheet, and the point
 * is to give the user just enough to decide whether to tap.
 */
export function factualSummary(place: Place, district: District | null): string {
  const parts = [placeTypeLabel(place)];

  if (district) parts.push(district.shortName);

  const notableTag = place.tags.find((tag) => tag !== 'ngoai-troi' && tag !== 'trong-nha');
  if (notableTag) parts.push(TAG_LABELS[notableTag]);

  return parts.join(' · ');
}

/** True when a place still needs a human to say something about it. */
export function needsDescription(place: Place): boolean {
  return !place.editorialNote;
}
