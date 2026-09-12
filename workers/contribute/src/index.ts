/**
 * Contribution endpoint.
 *
 * Takes a place suggestion or correction from the website and files it as a GitHub
 * issue, so contributors need no GitHub account — which is the whole point. Almost
 * nobody who knows a good quán has one.
 *
 * This is a public endpoint that writes to a repository, so most of the code here is
 * about refusing things rather than accepting them. The token never reaches the
 * browser; it lives as a Worker secret and only this code ever sees it.
 */

export type Env = {
  /** Fine-grained PAT, Issues: write on one repo only. Set with `wrangler secret put`. */
  GITHUB_TOKEN: string;
  /** "owner/repo". */
  GITHUB_REPO: string;
  /** Comma-separated origins allowed to call this. */
  ALLOWED_ORIGINS: string;
  /** Optional. When set, a Turnstile token is required and verified. */
  TURNSTILE_SECRET?: string;
};

/** Bodies larger than this are abuse, not contributions. */
const MAX_BODY_BYTES = 8_000;

const FIELD_LIMITS = {
  placeName: 120,
  address: 200,
  city: 60,
  district: 60,
  price: 60,
  hours: 120,
  goodFor: 80,
  note: 600,
  contact: 120,
  placeSlug: 120,
} as const;

type Submission = {
  kind: 'them-moi' | 'bo-sung' | 'bao-sai';
  placeName: string;
  placeSlug?: string;
  address?: string;
  city?: string;
  district?: string;
  price?: string;
  hours?: string;
  goodFor?: string;
  note?: string;
  contact?: string;
  /** Honeypot: a real person never fills a field they cannot see. */
  website?: string;
  turnstileToken?: string;
};

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim());
  const match = origin && allowed.includes(origin) ? origin : allowed[0]!;

  return {
    'Access-Control-Allow-Origin': match,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Trims, caps length, and strips control characters that would corrupt the issue body. */
function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      // Drop C0 control characters, which would corrupt the issue body,
      // but keep tab and newline so a multi-line note survives.
      return code > 31 || code === 9 || code === 10;
    })
    .join('')
    .trim()
    .slice(0, max);
}

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  if (!response.ok) return false;

  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

const KIND_LABELS: Record<Submission['kind'], string> = {
  'them-moi': 'Địa điểm mới',
  'bo-sung': 'Bổ sung thông tin',
  'bao-sai': 'Báo thông tin sai',
};

function buildIssue(submission: Submission, origin: string) {
  const title = `[${KIND_LABELS[submission.kind]}] ${submission.placeName}`;

  const rows: [string, string | undefined][] = [
    ['Loại đóng góp', KIND_LABELS[submission.kind]],
    ['Tên địa điểm', submission.placeName],
    ['Trang', submission.placeSlug ? `${origin}/dia-diem/${submission.placeSlug}/` : undefined],
    ['Thành phố', submission.city],
    ['Quận / khu vực', submission.district],
    ['Địa chỉ', submission.address],
    ['Khoảng giá một người', submission.price],
    ['Giờ mở cửa', submission.hours],
    ['Hợp đi với ai', submission.goodFor],
    ['Liên hệ (nếu muốn)', submission.contact],
  ];

  const table = rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => `| ${label} | ${value} |`)
    .join('\n');

  const body = [
    '| | |',
    '|---|---|',
    table,
    '',
    '### Mô tả của người gửi',
    '',
    submission.note ? `> ${submission.note.split('\n').join('\n> ')}` : '_(không có)_',
    '',
    '---',
    '',
    '_Gửi qua form trên didauday.tiennhm.io.vn. Nội dung do người dùng nhập —' +
      ' cần kiểm tra trước khi đưa vào `data/`._',
  ].join('\n');

  return { title, body };
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405, cors);

    const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim());
    if (origin && !allowed.includes(origin)) {
      return json({ error: 'Origin không được phép' }, 403, cors);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: 'Nội dung quá dài' }, 413, cors);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: 'JSON không hợp lệ' }, 400, cors);
    }

    const input = parsed as Partial<Submission>;

    // Honeypot. Answer 200 so a bot cannot tell it was caught and retune.
    if (clean(input.website, 200).length > 0) {
      return json({ ok: true }, 200, cors);
    }

    const kind = input.kind;
    if (kind !== 'them-moi' && kind !== 'bo-sung' && kind !== 'bao-sai') {
      return json({ error: 'Loại đóng góp không hợp lệ' }, 400, cors);
    }

    const submission: Submission = {
      kind,
      placeName: clean(input.placeName, FIELD_LIMITS.placeName),
      placeSlug: clean(input.placeSlug, FIELD_LIMITS.placeSlug),
      address: clean(input.address, FIELD_LIMITS.address),
      city: clean(input.city, FIELD_LIMITS.city),
      district: clean(input.district, FIELD_LIMITS.district),
      price: clean(input.price, FIELD_LIMITS.price),
      hours: clean(input.hours, FIELD_LIMITS.hours),
      goodFor: clean(input.goodFor, FIELD_LIMITS.goodFor),
      note: clean(input.note, FIELD_LIMITS.note),
      contact: clean(input.contact, FIELD_LIMITS.contact),
    };

    if (submission.placeName.length < 2) {
      return json({ error: 'Thiếu tên địa điểm' }, 400, cors);
    }

    // A submission with nothing but a name tells us nothing we did not have.
    const hasSubstance = [submission.address, submission.note, submission.price, submission.hours]
      .some((value) => (value ?? '').length >= 3);
    if (!hasSubstance) {
      return json({ error: 'Cần thêm ít nhất địa chỉ hoặc một câu mô tả' }, 400, cors);
    }

    if (env.TURNSTILE_SECRET) {
      const token = clean(input.turnstileToken, 4000);
      const ip = request.headers.get('CF-Connecting-IP');
      if (!token || !(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) {
        return json({ error: 'Không xác minh được. Thử tải lại trang.' }, 403, cors);
      }
    }

    const { title, body } = buildIssue(submission, allowed[0] ?? 'https://didauday.tiennhm.io.vn');

    const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'di-dau-day-contribute-worker',
      },
      body: JSON.stringify({ title, body, labels: ['đóng góp', kind] }),
    });

    if (!response.ok) {
      // Deliberately vague to the caller: a GitHub error message could disclose
      // repository details. The detail goes to the Worker log instead.
      console.error('GitHub API lỗi', response.status, await response.text());
      return json({ error: 'Không gửi được lúc này. Thử lại sau nhé.' }, 502, cors);
    }

    const issue = (await response.json()) as { number?: number };
    return json({ ok: true, issue: issue.number }, 200, cors);
  },
};

export default worker;
