import { REPO_URL } from '@/lib/site';

/**
 * Where contributions go.
 *
 * When the Cloudflare Worker is configured the form posts to it and the visitor
 * needs no account. When it is not, the form falls back to a prefilled GitHub issue
 * link. The fallback matters: it means the site is never broken by the Worker being
 * undeployed, misconfigured or down, and it is what shipped before the Worker existed.
 */
export const CONTRIBUTE_ENDPOINT = process.env.NEXT_PUBLIC_CONTRIBUTE_ENDPOINT ?? null;
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;

export type ContributionKind = 'them-moi' | 'bo-sung' | 'bao-sai';

export type Contribution = {
  readonly kind: ContributionKind;
  readonly placeName: string;
  readonly placeSlug?: string;
  readonly city?: string;
  readonly district?: string;
  readonly address?: string;
  readonly price?: string;
  readonly hours?: string;
  readonly goodFor?: string;
  readonly note?: string;
  readonly contact?: string;
};

const KIND_LABELS: Record<ContributionKind, string> = {
  'them-moi': 'Địa điểm mới',
  'bo-sung': 'Bổ sung thông tin',
  'bao-sai': 'Báo thông tin sai',
};

export function kindLabel(kind: ContributionKind): string {
  return KIND_LABELS[kind];
}

/** Prefilled GitHub issue URL — the no-Worker fallback, and the manual escape hatch. */
export function githubIssueUrl(contribution: Partial<Contribution>): string {
  const kind = contribution.kind ?? 'them-moi';
  const name = contribution.placeName ?? '';

  const body = [
    `**Loại:** ${KIND_LABELS[kind]}`,
    `**Tên địa điểm:** ${name}`,
    contribution.placeSlug ? `**Trang:** /dia-diem/${contribution.placeSlug}/` : null,
    '',
    `**Thành phố:** ${contribution.city ?? ''}`,
    `**Quận / khu vực:** ${contribution.district ?? ''}`,
    `**Địa chỉ:** ${contribution.address ?? ''}`,
    `**Khoảng giá một người:** ${contribution.price ?? ''}`,
    `**Giờ mở cửa:** ${contribution.hours ?? ''}`,
    '**Hợp đi với ai:** (một mình / người yêu / bạn bè / gia đình)',
    '',
    '**Một câu mô tả bằng lời của bạn:**',
    contribution.note ?? '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  const title = `[${KIND_LABELS[kind]}] ${name}`.trim();
  return `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
