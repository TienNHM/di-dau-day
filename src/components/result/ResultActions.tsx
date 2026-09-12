'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { track } from '@/lib/analytics/track';

/**
 * The three things a result is for: go there, send it to someone, try again.
 *
 * Share uses the Web Share API when available — on a phone that opens the native
 * sheet with Zalo and Messenger in it, which is where this product's sharing
 * actually happens. Clipboard is the desktop fallback.
 */
export function ResultActions({
  directionsHref,
  shareUrl,
  shareText,
  rerollHref,
  placeSlug,
}: {
  directionsHref: string;
  shareUrl: string;
  shareText: string;
  rerollHref: string;
  placeSlug: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    track('share_click', { place: placeSlug });

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url: shareUrl });
        return;
      } catch {
        // The user dismissing the share sheet throws here too, so fall through to
        // copy rather than showing an error for a deliberate cancel.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard can be blocked outright; the URL is in the address bar regardless.
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <a
        href={directionsHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('directions_click', { place: placeSlug })}
        className="w-full rounded-2xl bg-ink px-5 py-4 text-center text-lg font-bold text-cream transition active:scale-[0.98]"
      >
        🧭 Xem đường đi
      </a>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleShare}
          className="rounded-2xl bg-white px-4 py-3.5 font-semibold ring-1 ring-line transition active:scale-[0.98]"
        >
          {copied ? '✅ Đã copy link' : '📤 Chia sẻ'}
        </button>

        <Link
          href={rerollHref as Route}
          onClick={() => track('reroll_click', { place: placeSlug })}
          className="rounded-2xl bg-white px-4 py-3.5 text-center font-semibold ring-1 ring-line transition active:scale-[0.98]"
        >
          🎲 Chọn lại
        </Link>
      </div>
    </div>
  );
}
