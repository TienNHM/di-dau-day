import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/ui/PageShell';
import { REPO_URL, SITE_NAME, SUGGEST_FORM_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Gợi ý địa điểm',
  description: `Biết một chỗ hay mà ${SITE_NAME} chưa có? Kể tụi mình nghe.`,
  alternates: { canonical: '/dong-gop/' },
};

/**
 * Contributions matter more than the algorithm here: a good suggestion comes from
 * someone who has actually been there, and no amount of scoring compensates for a
 * thin catalogue. So this page asks for exactly the fields the data model needs,
 * in plain language, rather than a vague "tell us about a place".
 */
const ISSUE_URL = `${REPO_URL}/issues/new?title=${encodeURIComponent('Gợi ý địa điểm: ')}&body=${encodeURIComponent(
  [
    '**Tên địa điểm:**',
    '**Địa chỉ (càng chi tiết càng tốt):**',
    '**Quận:**',
    '**Khoảng giá một người:**',
    '**Giờ mở cửa:**',
    '**Hợp đi với ai:** (một mình / người yêu / bạn bè / gia đình)',
    '**Một câu mô tả chỗ này, bằng lời của bạn:**',
    '',
    '<!-- Cảm ơn bạn! Câu mô tả cuối là phần quan trọng nhất. -->',
  ].join('\n'),
)}`;

export default function ContributePage() {
  const primaryHref = SUGGEST_FORM_URL ?? ISSUE_URL;

  return (
    <PageShell>
      <main className="flex flex-1 flex-col gap-8 py-4">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-ink-faint underline-offset-4 hover:text-ink hover:underline"
          >
            ← {SITE_NAME}
          </Link>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance">
            Biết chỗ nào hay không?
          </h1>
          <p className="mt-3 text-lg text-ink-soft text-balance">
            Sản phẩm này chỉ tốt bằng đúng dữ liệu của nó. Một chỗ bạn thật sự từng đi đáng giá hơn
            mười chỗ chép từ trên mạng.
          </p>
        </div>

        <section className="rounded-card bg-white/70 p-5 ring-1 ring-line">
          <h2 className="text-base font-bold">Tụi mình cần gì</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-ink-soft">
            <li>📍 Tên và địa chỉ đủ để mở được trên bản đồ</li>
            <li>💰 Khoảng giá cho một người</li>
            <li>⏰ Giờ mở cửa, nếu bạn nhớ</li>
            <li>👥 Hợp đi một mình, đi đôi, đi nhóm hay đi cả nhà</li>
            <li>
              ✍️ <strong>Một câu mô tả bằng lời của bạn</strong> — phần này quan trọng nhất. “Ngồi
              ngoài bờ sông, chiều muộn có gió” nói được nhiều hơn mọi thông số.
            </li>
          </ul>
        </section>

        <a
          href={primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-ink px-6 py-4 text-center text-lg font-bold text-cream transition active:scale-[0.98]"
        >
          ✍️ Gửi gợi ý
        </a>

        <section>
          <h2 className="text-base font-bold">Báo thông tin sai</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Quán đã đóng cửa, đổi địa chỉ, hay giá đã khác? Báo giùm tụi mình bằng cùng đường link
            trên. Sai một toạ độ nghĩa là có người bấm “Xem đường đi” rồi chạy tới nhầm chỗ — tụi
            mình muốn tránh chuyện đó nhất.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold">Về bản quyền</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Đừng chép mô tả hay ảnh từ Google Maps, Foody hay trang khác. Tụi mình chỉ nhận nội
            dung do chính bạn viết, hoặc nội dung bạn có quyền chia sẻ.
          </p>
        </section>
      </main>
    </PageShell>
  );
}
