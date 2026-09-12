'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { Intent } from '@/lib/intents/registry';
import { track } from '@/lib/analytics/track';

/**
 * One choice on the landing page.
 *
 * Large tap target, one line of copy, and the accent gradient that will follow this
 * intent all the way through the spin and the result — so the flow reads as one
 * continuous thing rather than four unrelated screens.
 */
export function IntentCard({ intent, available }: { intent: Intent; available: boolean }) {
  const inner = (
    <>
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm transition-transform duration-300 group-hover:scale-105 group-active:scale-95"
        style={{
          backgroundImage: `linear-gradient(135deg, ${intent.accent.from}, ${intent.accent.to})`,
        }}
      >
        {intent.emoji}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold tracking-tight">{intent.label}</span>
        <span className="block truncate text-sm text-ink-soft">{intent.subtitle}</span>
      </span>

      {available ? (
        <span
          aria-hidden
          className="text-xl text-ink-faint transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-cream-deep px-2.5 py-1 text-xs font-semibold text-ink-faint">
          Sắp có
        </span>
      )}
    </>
  );

  const shared =
    'group flex w-full items-center gap-4 rounded-card bg-white/80 p-4 text-left ring-1 ring-line transition';

  if (!available) {
    return (
      <div className={`${shared} opacity-55`} aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={intent.path as Route}
      onClick={() => track('intent_select', { intent: intent.id })}
      className={`${shared} hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink/5 hover:ring-ink/10 active:translate-y-0`}
    >
      {inner}
    </Link>
  );
}
