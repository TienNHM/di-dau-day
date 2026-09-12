/**
 * Domain vocabulary for places.
 *
 * The value lists are the single source of truth: Zod schemas in `schema.ts`
 * are built from them, so adding a tag is a one-line change that immediately
 * validates seed data and type-checks every consumer.
 */

export const CATEGORIES = [
  'food',
  'cafe',
  'entertainment',
  'outdoor',
  'dating',
  'family',
  'shopping',
  'activity',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Who the user is going with. Drives the strongest single scoring signal after category. */
export const COMPANIONS = ['mot-minh', 'nguoi-yeu', 'ban-be', 'gia-dinh'] as const;
export type Companion = (typeof COMPANIONS)[number];

/**
 * Budget brackets, per person, in VND. Ordered — `score.ts` relies on the order
 * to give partial credit to an adjacent bracket.
 */
export const PRICE_RANGES = ['under-100k', '100-300k', '300-500k', 'over-500k'] as const;
export type PriceRange = (typeof PRICE_RANGES)[number];

export const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  'under-100k': 'Dưới 100K',
  '100-300k': '100–300K',
  '300-500k': '300–500K',
  'over-500k': 'Trên 500K',
};

/**
 * Curated tag vocabulary. Deliberately closed: a free-form tag list rots into
 * near-duplicates ("yen-tinh" / "yentinh" / "quiet") that silently stop matching.
 */
export const TAGS = [
  'lam-viec',
  'yen-tinh',
  'chill',
  'chup-anh',
  'lang-man',
  'view-dep',
  'ngoai-troi',
  'may-lanh',
  'nhom-dong',
  'gia-re',
  'sang-trong',
  'mo-khuya',
  'ven-song',
  'cay-xanh',
  'trong-nha',
  'van-dong',
  'tre-em',
  'thu-cung',
  'do-xe-de',
  'live-music',
  'doc-sach',
  'sang-som',
  'cuoi-tuan',
  'gan-trung-tam',
  'nghe-thuat',
  'lich-su',
  'do-an-ngon',
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  'lam-viec': 'Làm việc',
  'yen-tinh': 'Yên tĩnh',
  chill: 'Chill',
  'chup-anh': 'Chụp ảnh',
  'lang-man': 'Lãng mạn',
  'view-dep': 'View đẹp',
  'ngoai-troi': 'Ngoài trời',
  'may-lanh': 'Máy lạnh',
  'nhom-dong': 'Nhóm đông',
  'gia-re': 'Giá rẻ',
  'sang-trong': 'Sang trọng',
  'mo-khuya': 'Mở khuya',
  'ven-song': 'Ven sông',
  'cay-xanh': 'Nhiều cây xanh',
  'trong-nha': 'Trong nhà',
  'van-dong': 'Vận động',
  'tre-em': 'Hợp trẻ em',
  'thu-cung': 'Cho mang thú cưng',
  'do-xe-de': 'Dễ đỗ xe',
  'live-music': 'Nhạc sống',
  'doc-sach': 'Đọc sách',
  'sang-som': 'Mở sáng sớm',
  'cuoi-tuan': 'Hợp cuối tuần',
  'gan-trung-tam': 'Gần trung tâm',
  'nghe-thuat': 'Nghệ thuật',
  'lich-su': 'Lịch sử',
  'do-an-ngon': 'Đồ ăn ngon',
};

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** `['07:00', '22:30']`. A close earlier than open means the range runs past midnight. */
export type TimeRange = readonly [open: string, close: string];

/**
 * Compact opening hours: `default` covers every weekday, per-day keys override it.
 * An explicit empty array means closed that day. Omitting everything means unknown,
 * which scores neutrally rather than penalising a place for missing data.
 */
export type OpeningHours = {
  readonly default?: readonly TimeRange[];
  readonly mon?: readonly TimeRange[];
  readonly tue?: readonly TimeRange[];
  readonly wed?: readonly TimeRange[];
  readonly thu?: readonly TimeRange[];
  readonly fri?: readonly TimeRange[];
  readonly sat?: readonly TimeRange[];
  readonly sun?: readonly TimeRange[];
  readonly note?: string;
};

export type PlaceLocation = {
  readonly districtId: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  /** Preferred for directions when present — far more reliable than a name search. */
  readonly googleMapsPlaceId?: string;
};

export type PlaceImage = {
  readonly url: string;
  readonly alt: string;
  readonly credit?: string;
};

export type Sponsored = {
  /** ISO date. Past dates are ignored at read time so stale deals cannot linger. */
  readonly until: string;
  readonly label: string;
};

export type AffiliateLink = {
  readonly provider: string;
  readonly url: string;
  readonly label: string;
};

export type PlaceStatus = 'active' | 'hidden' | 'closed';

export type Place = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  /** Short form for the spin reel and OG image, where long names wrap badly. */
  readonly shortName?: string;
  readonly category: Category;
  readonly subCategory?: string;
  readonly tags: readonly Tag[];
  readonly goodFor: readonly Companion[];
  readonly priceRange: PriceRange;
  /** VND per person. Only used to render "~150K"; scoring uses the bracket. */
  readonly avgPrice?: number;
  readonly durationMinutes?: readonly [min: number, max: number];
  readonly location: PlaceLocation;
  readonly openingHours?: OpeningHours;
  readonly rating?: number;
  readonly ratingSource?: string;
  readonly images: readonly PlaceImage[];
  /** 0–100 editorial prior. Substitutes for the usage data we do not have yet. */
  readonly popularity: number;
  /** One sentence with personality — the reason a result is worth screenshotting. */
  readonly editorialNote?: string;
  readonly sponsored?: Sponsored;
  readonly affiliate?: readonly AffiliateLink[];
  readonly status: PlaceStatus;
  readonly updatedAt: string;
};

/**
 * The projection shipped to the browser.
 *
 * The wizard picks a place client-side, so scoring inputs must reach the client —
 * but address, images and editorial copy must not, since they would multiply the
 * payload for data only ever read on the destination page.
 */
export type PlaceSummary = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly shortName?: string;
  readonly category: Category;
  readonly tags: readonly Tag[];
  readonly goodFor: readonly Companion[];
  readonly priceRange: PriceRange;
  readonly avgPrice?: number;
  readonly durationMinutes?: readonly [min: number, max: number];
  readonly districtId: string;
  readonly lat: number;
  readonly lng: number;
  readonly openingHours?: OpeningHours;
  readonly popularity: number;
  readonly isSponsored: boolean;
};

export type District = {
  readonly id: string;
  readonly name: string;
  /** "Bình Thạnh" — used on the result card, where "Quận Bình Thạnh" is too long. */
  readonly shortName: string;
  readonly lat: number;
  readonly lng: number;
};

export type City = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly lat: number;
  readonly lng: number;
  readonly districts: readonly District[];
};

/** Drops the fields that only matter on the destination page. */
export function toPlaceSummary(place: Place): PlaceSummary {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    ...(place.shortName === undefined ? {} : { shortName: place.shortName }),
    category: place.category,
    tags: place.tags,
    goodFor: place.goodFor,
    priceRange: place.priceRange,
    ...(place.avgPrice === undefined ? {} : { avgPrice: place.avgPrice }),
    ...(place.durationMinutes === undefined ? {} : { durationMinutes: place.durationMinutes }),
    districtId: place.location.districtId,
    lat: place.location.lat,
    lng: place.location.lng,
    ...(place.openingHours === undefined ? {} : { openingHours: place.openingHours }),
    popularity: place.popularity,
    isSponsored: isSponsorshipActive(place.sponsored),
  };
}

/** Sponsorship past its `until` date is treated as absent, so stale deals expire on their own. */
export function isSponsorshipActive(sponsored: Sponsored | undefined, now = new Date()): boolean {
  if (!sponsored) return false;
  const until = new Date(sponsored.until);
  return !Number.isNaN(until.getTime()) && until.getTime() >= now.getTime();
}
