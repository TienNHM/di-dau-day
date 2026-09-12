import { PRICE_RANGE_LABELS, PRICE_RANGES } from '@/lib/places/types';
import type { Category, Companion, PriceRange, Tag } from '@/lib/places/types';

/**
 * Intents as data.
 *
 * Every wizard is the same component driven by an entry in this registry, so adding
 * "Đi đâu cuối tuần?" later is a new entry plus seed data — not a new page tree, a
 * new component, or a new state machine.
 */

export type IntentId = 'an-gi' | 'cafe' | 'hen-ho' | 'choi-gi' | 'di-dau';

/**
 * Accent colours live here as raw hex rather than Tailwind classes because the OG
 * image is rendered by satori, which has no Tailwind. One definition, used by the
 * card, the spin screen, the result page and the share image alike.
 */
export type Accent = {
  readonly from: string;
  readonly to: string;
  /** Text colour that stays readable on the gradient. */
  readonly on: string;
};

export type CompanionOption = { readonly value: Companion; readonly label: string; readonly emoji: string };
export type BudgetOption = { readonly value: PriceRange; readonly label: string; readonly hint?: string };
export type VibeOption = {
  readonly value: string;
  readonly label: string;
  readonly emoji: string;
  /** An option may stand for several tags — "Làm việc" implies quiet as well as wifi. */
  readonly tags: readonly Tag[];
};

export type FormatOption = {
  readonly value: 'mot-cho' | 'ca-buoi';
  readonly label: string;
  readonly emoji: string;
  readonly hint: string;
};

export type WizardQuestion =
  | { readonly kind: 'companion'; readonly title: string; readonly options: readonly CompanionOption[] }
  | { readonly kind: 'budget'; readonly title: string; readonly options: readonly BudgetOption[] }
  | {
      readonly kind: 'vibe';
      readonly title: string;
      readonly hint?: string;
      readonly options: readonly VibeOption[];
    }
  | { readonly kind: 'district'; readonly title: string; readonly hint?: string }
  | {
      readonly kind: 'format';
      readonly title: string;
      readonly options: readonly FormatOption[];
    };

export type Intent = {
  readonly id: IntentId;
  /** Route path. Also the share URL's `tu` parameter. */
  readonly path: `/${string}`;
  readonly emoji: string;
  /** Short label on the landing page button. */
  readonly label: string;
  /** Full question the intent answers, used as the page title. */
  readonly title: string;
  readonly subtitle: string;
  /** Categories this intent draws from. Also decides whether it has any data yet. */
  readonly categories: readonly Category[];
  readonly accent: Accent;
  readonly questions: readonly WizardQuestion[];
  /** Copy above the result, e.g. "Tụi mình chọn cho bạn". */
  readonly resultLead: string;
  /** Whether this intent can answer with a multi-stop plan instead of one place. */
  readonly supportsItinerary?: boolean;
};

const COMPANION_OPTIONS: readonly CompanionOption[] = [
  { value: 'mot-minh', label: 'Một mình', emoji: '🙂' },
  { value: 'nguoi-yeu', label: 'Người yêu', emoji: '❤️' },
  { value: 'ban-be', label: 'Bạn bè', emoji: '🎉' },
  { value: 'gia-dinh', label: 'Gia đình', emoji: '👨‍👩‍👧' },
];

/** Budget options are shared: the brackets mean the same thing in every intent. */
const budgetOptions = (hints: Partial<Record<PriceRange, string>> = {}): readonly BudgetOption[] =>
  PRICE_RANGES.map((value) => ({
    value,
    label: PRICE_RANGE_LABELS[value],
    ...(hints[value] ? { hint: hints[value] } : {}),
  }));

const DISTRICT_QUESTION: WizardQuestion = {
  kind: 'district',
  title: 'Bạn ở khu nào?',
  hint: 'Bỏ qua cũng được — tụi mình sẽ tìm khắp thành phố.',
};

export const INTENTS: readonly Intent[] = [
  {
    id: 'an-gi',
    path: '/an-gi',
    emoji: '🍜',
    label: 'Ăn gì',
    title: 'Hôm nay ăn gì?',
    subtitle: 'Vỉa hè hay máy lạnh đều có.',
    categories: ['food'],
    accent: { from: '#ef4d23', to: '#f5a524', on: '#ffffff' },
    resultLead: 'Bữa nay ăn ở đây đi',
    questions: [
      {
        kind: 'vibe',
        title: 'Bạn đang muốn gì?',
        hint: 'Chọn một hoặc vài kiểu.',
        options: [
          { value: 'ngon-re', label: 'Ngon mà rẻ', emoji: '🤑', tags: ['gia-re', 'do-an-ngon'] },
          { value: 'may-lanh', label: 'Ngồi máy lạnh', emoji: '❄️', tags: ['may-lanh', 'trong-nha'] },
          { value: 'khuya', label: 'Ăn khuya', emoji: '🌙', tags: ['mo-khuya'] },
          { value: 'nhom-dong', label: 'Đi nhóm đông', emoji: '👥', tags: ['nhom-dong', 'do-xe-de'] },
          { value: 'sang-trong', label: 'Dịp đặc biệt', emoji: '🥂', tags: ['sang-trong'] },
        ],
      },
      { kind: 'budget', title: 'Ngân sách một người?', options: budgetOptions({ 'under-100k': 'Cơm bụi, bún phở' }) },
      DISTRICT_QUESTION,
    ],
  },
  {
    id: 'cafe',
    path: '/cafe',
    emoji: '☕',
    label: 'Cafe',
    title: 'Cafe nào bây giờ?',
    subtitle: 'Hợp việc bạn định làm.',
    categories: ['cafe'],
    accent: { from: '#8b5a2b', to: '#c78a3e', on: '#ffffff' },
    resultLead: 'Ghé đây làm ly',
    questions: [
      {
        kind: 'vibe',
        title: 'Bạn tới cafe để làm gì?',
        hint: 'Chọn một hoặc vài kiểu.',
        options: [
          { value: 'lam-viec', label: 'Làm việc', emoji: '💻', tags: ['lam-viec', 'yen-tinh', 'may-lanh'] },
          { value: 'hen-ho', label: 'Hẹn hò', emoji: '❤️', tags: ['lang-man', 'yen-tinh'] },
          { value: 'chill', label: 'Chill', emoji: '🌿', tags: ['chill', 'cay-xanh'] },
          { value: 'chup-anh', label: 'Chụp ảnh', emoji: '📸', tags: ['chup-anh', 'view-dep'] },
          { value: 'doc-sach', label: 'Đọc sách', emoji: '📖', tags: ['doc-sach', 'yen-tinh'] },
        ],
      },
      { kind: 'budget', title: 'Ngân sách một người?', options: budgetOptions() },
      DISTRICT_QUESTION,
    ],
  },
  {
    id: 'hen-ho',
    path: '/hen-ho',
    emoji: '❤️',
    label: 'Hẹn hò',
    title: 'Hẹn hò ở đâu?',
    subtitle: 'Khỏi phải nghĩ nhiều.',
    categories: ['dating', 'cafe', 'outdoor', 'entertainment', 'food', 'activity'],
    accent: { from: '#8b3a86', to: '#ef4d23', on: '#ffffff' },
    resultLead: 'Rủ người ta tới đây',
    supportsItinerary: true,
    questions: [
      {
        kind: 'format',
        title: 'Một chỗ thôi hay cả buổi?',
        options: [
          {
            value: 'mot-cho',
            label: 'Một chỗ thôi',
            emoji: '📍',
            hint: 'Tụi mình chọn đúng một địa điểm',
          },
          {
            value: 'ca-buoi',
            label: 'Lên nguyên buổi tối',
            emoji: '🗓️',
            hint: 'Cà phê → đi chơi → ăn tối',
          },
        ],
      },
      {
        kind: 'vibe',
        title: 'Buổi hẹn kiểu gì?',
        hint: 'Chọn một hoặc vài kiểu.',
        options: [
          { value: 'lang-man', label: 'Lãng mạn', emoji: '🌆', tags: ['lang-man', 'view-dep'] },
          { value: 'yen-tinh', label: 'Yên tĩnh, dễ nói chuyện', emoji: '🤫', tags: ['yen-tinh'] },
          { value: 'ngoai-troi', label: 'Ngoài trời', emoji: '🌳', tags: ['ngoai-troi', 'cay-xanh'] },
          { value: 'chup-anh', label: 'Có chỗ chụp ảnh', emoji: '📸', tags: ['chup-anh'] },
          { value: 'hoat-dong', label: 'Có gì đó để làm', emoji: '🎯', tags: ['van-dong', 'nghe-thuat'] },
        ],
      },
      { kind: 'budget', title: 'Ngân sách một người?', options: budgetOptions() },
      DISTRICT_QUESTION,
    ],
  },
  {
    id: 'choi-gi',
    path: '/choi-gi',
    emoji: '🎮',
    label: 'Chơi gì',
    title: 'Chơi gì đây?',
    subtitle: 'Khi ngồi cafe mãi cũng chán.',
    categories: ['entertainment', 'activity'],
    accent: { from: '#0f9d8f', to: '#0ea5b7', on: '#ffffff' },
    resultLead: 'Thử cái này xem',
    questions: [
      { kind: 'companion', title: 'Bạn đi với ai?', options: COMPANION_OPTIONS },
      { kind: 'budget', title: 'Ngân sách một người?', options: budgetOptions() },
      DISTRICT_QUESTION,
    ],
  },
  {
    id: 'di-dau',
    path: '/di-dau',
    emoji: '🌳',
    label: 'Đi đâu',
    title: 'Đi đâu bây giờ?',
    subtitle: 'Ra khỏi nhà đã, tính sau.',
    categories: ['outdoor', 'dating', 'family'],
    accent: { from: '#0f9d8f', to: '#7cb342', on: '#ffffff' },
    resultLead: 'Tụi mình chọn cho bạn',
    questions: [
      { kind: 'companion', title: 'Bạn đi với ai?', options: COMPANION_OPTIONS },
      {
        kind: 'budget',
        title: 'Ngân sách một người?',
        options: budgetOptions({ 'under-100k': 'Công viên, đi dạo' }),
      },
      DISTRICT_QUESTION,
    ],
  },
];

export function getIntent(id: string): Intent | undefined {
  return INTENTS.find((intent) => intent.id === id);
}

/** Flattens a vibe answer back into the tags the scorer understands. */
export function tagsForVibes(question: WizardQuestion, values: readonly string[]): readonly Tag[] {
  if (question.kind !== 'vibe') return [];
  const selected = question.options.filter((option) => values.includes(option.value));
  return [...new Set(selected.flatMap((option) => option.tags))];
}
