import Link from 'next/link';
import type { Metadata } from 'next';
import { PageShell } from '@/components/ui/PageShell';
import { SiteFooter } from '@/components/ui/SiteFooter';
import { INTENTS } from '@/lib/intents/registry';
import { SITE_NAME } from '@/lib/site';

/**
 * The 404, written for the way people actually arrive at one here.
 *
 * Almost nobody mistypes these URLs. They land here because a link is older than the
 * data: places are re-imported from Overture, and a record that moves or is renamed
 * takes its slug with it. A tab left open across a deploy does the same thing — the
 * page it was holding recommends a slug the new build no longer has.
 *
 * So this is not "you took a wrong turn". It is a dead end with the one thing the
 * visitor came for placed directly in front of them: another suggestion, one tap away.
 */

export const metadata: Metadata = {
  title: 'Không tìm thấy trang',
  // Nothing here is worth a search result, and indexing 404s dilutes the real pages.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <PageShell>
      <main className="flex flex-1 flex-col justify-center py-10 text-center">
        <p className="text-6xl" aria-hidden>
          🧭
        </p>

        <h1 className="mt-5 text-3xl leading-tight font-extrabold tracking-tight text-balance">
          Chỗ này không còn nữa
        </h1>

        <p className="mx-auto mt-3 max-w-sm leading-relaxed text-ink-soft">
          Có thể quán đã đóng, đổi tên, hoặc link bạn mở đã cũ hơn dữ liệu của tụi mình.
          Không sao — chọn lại một chỗ khác nhé.
        </p>

        <nav className="mt-8 flex flex-col gap-2.5">
          {INTENTS.map((intent) => (
            <Link
              key={intent.id}
              href={intent.path}
              className="flex items-center gap-3 rounded-2xl bg-white/70 px-5 py-4 text-left font-semibold ring-1 ring-line transition active:scale-[0.98] hover:bg-white"
            >
              <span aria-hidden className="text-2xl">
                {intent.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">{intent.title}</span>
                <span className="block text-sm font-normal text-ink-faint">{intent.subtitle}</span>
              </span>
              <span aria-hidden className="text-ink-faint">
                →
              </span>
            </Link>
          ))}
        </nav>

        <p className="mt-6 text-sm text-ink-faint">
          Hoặc quay về{' '}
          <Link href="/" className="font-medium underline underline-offset-4 hover:text-ink">
            {SITE_NAME}
          </Link>
        </p>
      </main>

      <SiteFooter />
    </PageShell>
  );
}
