'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { track } from '@/lib/analytics/track';
import { shareStory } from '@/lib/share/share-story';
import type { StoryInput } from '@/lib/share/story-card';

/**
 * What a result is for: go there, post it, send it, try again.
 *
 * Two kinds of sharing, because they are not the same act. Sending a link to one
 * person is a message; putting it on a story is broadcasting to everyone you know,
 * and a bare link is a poor thing to broadcast — it renders as a small grey preview
 * card, if it renders at all. The story button hands over a 1080×1920 image instead.
 *
 * Both use the native sheet, which is where Zalo, Messenger, Instagram and Facebook
 * actually live on a phone. Clipboard and a file download are the desktop fallbacks.
 */
export function ResultActions({
  directionsHref,
  shareUrl,
  shareText,
  rerollHref,
  placeSlug,
  story,
}: {
  directionsHref: string;
  shareUrl: string;
  shareText: string;
  rerollHref: string;
  placeSlug: string;
  story: StoryInput;
}) {
  const [copied, setCopied] = useState(false);
  const [storyState, setStoryState] = useState<'idle' | 'working' | 'saved' | 'failed'>('idle');

  async function handleStory() {
    // Drawing is fast but not free, and on a cold font cache `document.fonts.ready`
    // can take a beat. Say so rather than leaving a dead button.
    setStoryState('working');
    track('share_story_click', { place: placeSlug });

    const outcome = await shareStory(story, {
      filename: `di-dau-day-${placeSlug}.png`,
      text: `${shareText}
${shareUrl}`,
    });

    // A cancel is the user changing their mind, not a failure to report.
    if (outcome === 'cancelled' || outcome === 'shared') setStoryState('idle');
    else if (outcome === 'downloaded') setStoryState('saved');
    else setStoryState('failed');

    if (outcome === 'downloaded' || outcome === 'failed') {
      setTimeout(() => setStoryState('idle'), 2600);
    }
  }

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

      {/* Full width on a phone, where a story is actually posted from. */}
      <button
        type="button"
        onClick={handleStory}
        disabled={storyState === 'working'}
        className="story-button w-full rounded-2xl px-5 py-4 text-center text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-70"
      >
        {storyState === 'working'
          ? 'Đang tạo ảnh…'
          : storyState === 'saved'
            ? '✅ Đã lưu ảnh'
            : storyState === 'failed'
              ? 'Không tạo được ảnh'
              : '✨ Đăng lên story'}
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleShare}
          className="rounded-2xl bg-white px-4 py-3.5 font-semibold ring-1 ring-line transition active:scale-[0.98]"
        >
          {copied ? '✅ Đã copy link' : '🔗 Gửi link'}
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
