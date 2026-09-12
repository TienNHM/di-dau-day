import Link from 'next/link';
import { AUTHOR_NAME, AUTHOR_URL } from '@/lib/site';

/**
 * The footer, on every page that is a destination rather than a step.
 *
 * Deliberately absent from the wizard and the reveal: those are a fifteen-second
 * flow with one thing to do, and a row of links under them is an invitation to leave
 * halfway through.
 */
export function SiteFooter({ lead }: { lead?: string }) {
  return (
    <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-6 text-sm text-ink-faint">
      {lead ? (
        <>
          <span>{lead}</span>
          <span aria-hidden>·</span>
        </>
      ) : null}

      <Link className="underline-offset-4 hover:text-ink hover:underline" href="/ve-chung-toi">
        Về tụi mình
      </Link>
      <Link className="underline-offset-4 hover:text-ink hover:underline" href="/dong-gop">
        Gợi ý địa điểm
      </Link>

      {/* A plain followed link. This is the author's own site, so there is nothing to
          disclaim — `nofollow` here would only throw away the one signal the link is
          for. `noopener` stays: it is about the opened tab, not about ranking. */}
      <a
        className="underline-offset-4 hover:text-ink hover:underline"
        href={AUTHOR_URL}
        target="_blank"
        rel="noopener"
        title={`${AUTHOR_NAME} — trang cá nhân`}
      >
        Làm bởi {AUTHOR_NAME}
      </a>
    </footer>
  );
}
