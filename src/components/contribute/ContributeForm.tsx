'use client';

import { useId, useRef, useState } from 'react';
import Script from 'next/script';
import { CONTRIBUTE_ENDPOINT, githubIssueUrl, kindLabel } from '@/lib/contribute';
import type { ContributionKind } from '@/lib/contribute';
import { track } from '@/lib/analytics/track';
import { useTurnstile } from './useTurnstile';
import { REPO_URL } from '@/lib/site';

/**
 * The contribution form.
 *
 * Deliberately short. Every field asked for is a field somebody might not answer, and
 * the one that matters most — a sentence in the contributor's own words — is the one
 * no dataset can supply. Only the name and that sentence (or an address) are required.
 *
 * There are two paths on purpose. The form is for everyone — almost nobody who knows
 * a good quán has a GitHub account. The GitHub link below it is for developers, who
 * would rather open an issue or edit `data/places` directly than fill in a form. Both
 * land in the same inbox.
 *
 * With no Worker configured the form cannot submit, so only the GitHub path is shown
 * and the page is never broken by missing infrastructure.
 */

type Status = { state: 'idle' } | { state: 'sending' } | { state: 'sent' } | { state: 'error'; message: string };

const KIND_OPTIONS: readonly { value: ContributionKind; label: string; hint: string }[] = [
  { value: 'them-moi', label: 'Gợi ý chỗ mới', hint: 'Tụi mình chưa có chỗ này' },
  { value: 'bo-sung', label: 'Bổ sung thông tin', hint: 'Đã có nhưng thiếu giá, giờ, mô tả' },
  { value: 'bao-sai', label: 'Báo thông tin sai', hint: 'Sai địa chỉ, đã đóng cửa…' },
];

/**
 * The shortest description worth filing.
 *
 * Below this it is a label, not a description — "ngon", "ok", "đẹp" tell the next
 * reader nothing they could act on. The number is deliberately low: the point is to
 * stop empty submissions, not to demand an essay.
 */
const MIN_NOTE_LENGTH = 15;

export function ContributeForm({
  defaultKind = 'them-moi',
  place,
}: {
  defaultKind?: ContributionKind;
  place?: { slug: string; name: string; city?: string; district?: string };
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<ContributionKind>(defaultKind);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstile = useTurnstile(turnstileRef);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!CONTRIBUTE_ENDPOINT) return;

    const data = new FormData(event.currentTarget);
    const payload = {
      kind,
      placeName: String(data.get('placeName') ?? ''),
      placeSlug: place?.slug ?? '',
      city: String(data.get('city') ?? ''),
      district: String(data.get('district') ?? ''),
      address: String(data.get('address') ?? ''),
      price: String(data.get('price') ?? ''),
      hours: String(data.get('hours') ?? ''),
      goodFor: data.getAll('goodFor').join(', '),
      note: String(data.get('note') ?? ''),
      contact: String(data.get('contact') ?? ''),
      website: String(data.get('website') ?? ''),
      turnstileToken: turnstile.token ?? '',
    };

    setStatus({ state: 'sending' });
    track('contribute_submit', { kind });

    try {
      const response = await fetch(CONTRIBUTE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus({ state: 'error', message: body.error ?? 'Không gửi được. Thử lại sau nhé.' });
        return;
      }

      setStatus({ state: 'sent' });
      formRef.current?.reset();
    } catch {
      setStatus({ state: 'error', message: 'Mất kết nối. Kiểm tra mạng rồi thử lại nhé.' });
    }
  }

  if (status.state === 'sent') {
    return (
      <div className="rounded-card bg-white/70 p-6 text-center ring-1 ring-line">
        <p className="text-4xl" aria-hidden>
          🙏
        </p>
        <h2 className="mt-3 text-xl font-bold">Cảm ơn bạn</h2>
        <p className="mt-2 text-ink-soft">
          Tụi mình đã nhận được. Sẽ kiểm tra rồi đưa lên trong vài ngày tới.
        </p>
        <button
          type="button"
          onClick={() => setStatus({ state: 'idle' })}
          className="mt-5 rounded-2xl bg-ink px-5 py-3 font-semibold text-cream"
        >
          Gửi thêm chỗ khác
        </button>
      </div>
    );
  }

  // No Worker configured: show only the GitHub path rather than a form whose submit
  // button cannot work.
  if (!CONTRIBUTE_ENDPOINT) {
    return (
      <div className="rounded-card bg-white/70 p-5 ring-1 ring-line">
        <p className="leading-relaxed text-ink-soft">
          Form gửi trực tiếp đang được cài đặt. Trong lúc chờ, bạn gửi giúp tụi mình qua GitHub
          nhé — cần có tài khoản GitHub.
        </p>
        <a
          href={githubIssueUrl({ kind, placeName: place?.name ?? '', ...(place?.slug ? { placeSlug: place.slug } : {}) })}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-2xl bg-ink px-5 py-3 font-semibold text-cream"
        >
          ✍️ Gửi qua GitHub
        </a>
      </div>
    );
  }

  const sending = status.state === 'sending';
  const waitingForVerification = turnstile.required && turnstile.token === null && !turnstile.failed;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {turnstile.required ? (
        // Explicit render: the hook needs the API before it can hand over its
        // expiry and error callbacks.
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={turnstile.onScriptLoad}
        />
      ) : null}

      <fieldset>
        <legend className="text-sm font-semibold text-ink-soft">Bạn muốn gửi gì?</legend>
        <div className="mt-2 flex flex-col gap-2">
          {KIND_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition ${
                kind === option.value ? 'border-brand bg-white' : 'border-line bg-white/60'
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="size-4 accent-brand"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-sm text-ink-faint">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field id={`${formId}-name`} name="placeName" label="Tên địa điểm" required defaultValue={place?.name} />

      {/* Required, and first. Tụi mình đã có hơn 4.000 địa điểm từ dữ liệu mở — thứ
          không nguồn nào có là một câu của người từng tới. Đây là lý do form này tồn
          tại, nên nó là trường bắt buộc chứ không phải trường tuỳ chọn nằm cuối. */}
      <Field
        id={`${formId}-note`}
        name="note"
        label={noteLabel(kind)}
        hint={noteHint(kind)}
        required
        minLength={MIN_NOTE_LENGTH}
        textarea
      />

      {/* Only for a place we do not have yet: without an address we cannot put it on
          a map, and a place nobody can find is not worth a record. For the other two
          kinds the place already exists and its address is already on file. */}
      <Field
        id={`${formId}-address`}
        name="address"
        label="Địa chỉ"
        hint="Càng chi tiết càng tốt — tụi mình cần mở được trên bản đồ."
        required={kind === 'them-moi'}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field id={`${formId}-city`} name="city" label="Thành phố" defaultValue={place?.city} />
        <Field id={`${formId}-district`} name="district" label="Quận / khu vực" defaultValue={place?.district} />
        <Field id={`${formId}-price`} name="price" label="Giá một người" hint="vd: 50–80K" />
        <Field id={`${formId}-hours`} name="hours" label="Giờ mở cửa" hint="vd: 7h–22h" />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-ink-soft">Hợp đi với ai?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {['Một mình', 'Người yêu', 'Bạn bè', 'Gia đình'].map((label) => (
            <label
              key={label}
              className="cursor-pointer rounded-full bg-white/60 px-3.5 py-2 text-sm font-medium ring-1 ring-line has-checked:bg-brand-soft has-checked:ring-brand/40"
            >
              <input type="checkbox" name="goodFor" value={label} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        id={`${formId}-contact`}
        name="contact"
        label="Liên hệ của bạn"
        hint="Không bắt buộc. Chỉ dùng khi tụi mình cần hỏi lại."
      />

      {/* Honeypot. Hidden from people and from screen readers; bots fill it anyway. */}
      <div aria-hidden className="hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {turnstile.required ? (
        <div>
          <div ref={turnstileRef} />
          {turnstile.failed ? (
            <p className="mt-2 text-sm text-brand-deep">
              Không chạy được bước xác minh. Thử tải lại trang, hoặc gửi qua GitHub bên dưới.
            </p>
          ) : null}
        </div>
      ) : null}

      {status.state === 'error' ? (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium text-brand-deep">
          {status.message}
        </p>
      ) : null}

      {/* Blocked until Turnstile has produced a token. Letting the submit through
          early would send an empty token, and the user would get a verification
          error after having typed everything — the worst possible moment. */}
      <button
        type="submit"
        disabled={sending || waitingForVerification}
        className="rounded-2xl bg-ink px-6 py-4 text-lg font-bold text-cream transition active:scale-[0.98] disabled:opacity-50"
      >
        {sending
          ? 'Đang gửi…'
          : waitingForVerification
            ? 'Đang xác minh…'
            : `Gửi ${kindLabel(kind).toLowerCase()}`}
      </button>

      <p className="text-center text-xs text-ink-faint">
        Đừng chép mô tả hay ảnh từ Google Maps, Foody hay trang khác — tụi mình chỉ nhận nội dung
        bạn tự viết.
      </p>

      {/* Second path, kept visible rather than hidden behind a failure. Developers
          would rather open an issue or a pull request against data/ than fill in a
          form, and both routes land in the same inbox. */}
      <p className="border-t border-line pt-4 text-center text-sm text-ink-faint">
        Quen dùng GitHub hơn?{' '}
        <a
          href={githubIssueUrl({
            kind,
            placeName: place?.name ?? '',
            ...(place?.slug ? { placeSlug: place.slug } : {}),
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-4 hover:text-ink"
        >
          Mở issue trực tiếp
        </a>{' '}
        — hoặc sửa thẳng trong{' '}
        <a
          href={`${REPO_URL}/tree/main/data/places`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-4 hover:text-ink"
        >
          data/places
        </a>{' '}
        rồi gửi pull request.
      </p>
    </form>
  );
}

/** What the description is asking for depends on why they are writing. */
function noteLabel(kind: ContributionKind): string {
  switch (kind) {
    case 'them-moi':
      return 'Chỗ này thế nào? Kể bằng lời của bạn';
    case 'bo-sung':
      return 'Bạn muốn bổ sung gì?';
    case 'bao-sai':
      return 'Thông tin nào đang sai?';
  }
}

function noteHint(kind: ContributionKind): string {
  switch (kind) {
    case 'them-moi':
      return '“Ngồi ngoài bờ sông, chiều muộn có gió” nói được nhiều hơn mọi thông số. Đây là phần tụi mình không lấy được từ đâu khác.';
    case 'bo-sung':
      return 'Giá, giờ mở cửa, không gian — bất cứ thứ gì trang đang thiếu.';
    case 'bao-sai':
      return 'Càng cụ thể càng tốt: sai địa chỉ, đã đóng cửa, đổi tên…';
  }
}

function Field({
  id,
  name,
  label,
  hint,
  required,
  minLength,
  textarea,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
  textarea?: boolean;
  defaultValue?: string;
}) {
  const shared =
    'mt-1.5 w-full rounded-2xl border-2 border-line bg-white/70 px-4 py-3 outline-none transition focus:border-brand focus:bg-white';

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
        {label}
        {required ? <span className="text-brand"> *</span> : null}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          rows={3}
          required={required}
          minLength={minLength}
          defaultValue={defaultValue}
          className={shared}
        />
      ) : (
        <input
          id={id}
          name={name}
          type="text"
          required={required}
          minLength={minLength}
          defaultValue={defaultValue}
          className={shared}
        />
      )}
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}
