'use client';

import { useSpinSequence } from './useSpinSequence';
import type { Accent } from '@/lib/intents/registry';
import type { ScoredPlace } from '@/lib/recommend/score';

/**
 * The reveal.
 *
 * The reel shows real candidates — the places that actually scored well for these
 * answers — not filler. If the animation lied about what was considered, the moment
 * it lands would be theatre; because it does not, the user sees the shortlist they
 * were chosen from and the result reads as a decision.
 */
export function SpinStage({
  candidates,
  winner,
  accent,
  onComplete,
}: {
  candidates: readonly ScoredPlace[];
  winner: ScoredPlace;
  accent: Accent;
  onComplete: () => void;
}) {
  const names = candidates.map((candidate) => candidate.place.shortName ?? candidate.place.name);
  const { index, phase } = useSpinSequence({ stepCount: names.length, onComplete });

  const winnerName = winner.place.shortName ?? winner.place.name;
  const displayed = phase === 'landed' ? winnerName : (names[index % names.length] ?? winnerName);

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

      {/* aria-live announces only the final answer; narrating every reel frame
          would flood a screen reader with names that were never chosen. */}
      <p
        key={displayed}
        className={`mt-6 text-4xl leading-tight font-extrabold text-balance transition-all duration-200 sm:text-5xl ${
          phase === 'landed' ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-90'
        }`}
      >
        {displayed}
      </p>

      <p aria-live="polite" className="sr-only">
        {phase === 'landed' ? `Đã chọn ${winnerName}` : ''}
      </p>

      <p className="mt-6 text-sm opacity-75">
        {phase === 'landed'
          ? 'Đang mở kết quả…'
          : `Đang cân nhắc ${candidates.length} lựa chọn hợp với bạn`}
      </p>
    </div>
  );
}
