'use client';

import { useSpinSequence } from './useSpinSequence';
import type { Accent } from '@/lib/intents/registry';
import type { PlaceSummary } from '@/lib/places/types';

/**
 * The reveal.
 *
 * The reel shows real candidates — the places that actually scored well for these
 * answers — not filler. If the animation lied about what was considered, the moment
 * it lands would be theatre; because it does not, the user sees the shortlist they
 * were chosen from and the result reads as a decision.
 */

export type SpinCandidate = { readonly place: PlaceSummary; readonly label: string };

export function SpinStage({
  candidates,
  winnerLabel,
  landedNote,
  accent,
  onComplete,
}: {
  candidates: readonly SpinCandidate[];
  winnerLabel: string;
  /** Extra line under the winner — used by the itinerary to say "và 2 chặng nữa". */
  landedNote?: string;
  accent: Accent;
  onComplete: () => void;
}) {
  const { index, phase } = useSpinSequence({ stepCount: candidates.length, onComplete });

  const displayed =
    phase === 'landed' ? winnerLabel : (candidates[index % candidates.length]?.label ?? winnerLabel);

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center rounded-card px-6 py-16 text-center"
      style={{
        backgroundImage: `linear-gradient(160deg, ${accent.from}, ${accent.to})`,
        color: accent.on,
      }}
    >
      <p className="text-sm font-semibold tracking-[0.2em] uppercase opacity-80">
        {phase === 'landed' ? 'Đây rồi' : '🎲 Đang chọn'}
      </p>

      <p
        key={displayed}
        className={`mt-6 text-4xl leading-tight font-extrabold text-balance transition-all duration-200 sm:text-5xl ${
          phase === 'landed' ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-90'
        }`}
      >
        {displayed}
      </p>

      {phase === 'landed' && landedNote ? (
        <p className="mt-3 text-lg font-semibold opacity-85">{landedNote}</p>
      ) : null}

      {/* Announce only the final answer: narrating every reel frame would flood a
          screen reader with names that were never chosen. */}
      <p aria-live="polite" className="sr-only">
        {phase === 'landed' ? `Đã chọn ${winnerLabel}` : ''}
      </p>

      <p className="mt-6 text-sm opacity-75">
        {phase === 'landed'
          ? 'Đang mở kết quả…'
          : `Đang cân nhắc ${candidates.length} lựa chọn hợp với bạn`}
      </p>
    </div>
  );
}
