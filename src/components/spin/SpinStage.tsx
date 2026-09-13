'use client';

import { useEffect, useMemo, useState } from 'react';
import { REEL_DURATION_MS, useSpinSequence } from './useSpinSequence';
import { Confetti } from './Confetti';
import type { Accent } from '@/lib/intents/registry';

/**
 * The reveal.
 *
 * The reel shows real candidates — the places that actually scored well for these
 * answers — not filler. If the animation lied about what was considered, the moment
 * it lands would be theatre; because it does not, the user sees the shortlist they
 * were chosen from and the result reads as a decision.
 *
 * The motion is one CSS transform on one element, so the whole reel is handed to the
 * compositor and keeps its frame rate on a mid-range phone. The previous version
 * swapped text on a `setTimeout` ladder, which re-rendered React fourteen times and
 * could not decelerate smoothly because each step was a discrete jump.
 */

/** Just the labels: the reel shows names, and never needed the records behind them. */
export type SpinCandidate = string;

/**
 * Height of one slot, in pixels.
 *
 * Fixed rather than relative, because the landing offset is `slots * height` and any
 * mismatch would stop the reel between two names. Sized for the small end first: two
 * lines of the mobile type size fit, which is what a long Vietnamese place name needs
 * — "Bánh Xèo Bà Dưỡng Chi Nhánh Hải Châu" does not fit one line on a 360px phone.
 */
const SLOT_HEIGHT = 96;
/** How many names travel past before the winner. More than this and the wait drags. */
const REEL_LENGTH = 22;

export function SpinStage({
  candidates,
  winnerLabel,
  landedNote,
  waitingNote,
  accent,
  onComplete,
}: {
  candidates: readonly SpinCandidate[];
  winnerLabel: string;
  /** Extra line under the winner — used by the itinerary to say "và 2 chặng nữa". */
  landedNote?: string;
  /** What is being shuffled, for the line under the reel. Defaults to places. */
  waitingNote?: string;
  accent: Accent;
  onComplete: () => void;
}) {
  const { phase, land, skipReel } = useSpinSequence({ stepCount: candidates.length, onComplete });

  /*
   * The reel's travel lives in state, not in an imperative `node.style.transform`.
   *
   * It used to be set by hand from a ref callback while React's own `style` prop said
   * `translate3d(0,0,0)` — so the first re-render after the spin started wrote the
   * transform back to zero and the reel either froze or ran backwards. On desktop no
   * re-render happened to land inside the animation; on Chrome for Android one did,
   * and the whole reveal showed nothing at all.
   *
   * Two frames, not one: the strip has to be painted at offset zero before the
   * transition is allowed to begin, or the browser coalesces both values into the
   * same frame and there is nothing to animate between.
   */
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (skipReel) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setRunning(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [skipReel]);

  /**
   * The strip: real candidates on the way past, the winner in the final slot.
   *
   * Built once. Rebuilding it mid-spin would restart the transition from a new
   * starting offset and the reel would visibly stutter.
   */
  const slots = useMemo(() => {
    const labels = candidates;
    if (labels.length === 0) return [winnerLabel];

    const strip: string[] = [];
    for (let index = 0; index < REEL_LENGTH - 1; index += 1) {
      strip.push(labels[index % labels.length]!);
    }
    strip.push(winnerLabel);
    return strip;
  }, [candidates, winnerLabel]);

  const travel = (slots.length - 1) * SLOT_HEIGHT;
  const landed = phase === 'landed';

  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-card px-4 py-12 text-center sm:px-6 sm:py-16"
      style={{
        backgroundImage: `linear-gradient(160deg, ${accent.from}, ${accent.to})`,
        color: accent.on,
      }}
    >
      {/* Two slow drifting blooms. They give the flat gradient some life during the
          wait without competing with the reel for attention. */}
      <div aria-hidden className="spin-bloom spin-bloom-a" />
      <div aria-hidden className="spin-bloom spin-bloom-b" />

      {landed ? <Confetti accent={accent} /> : null}

      <p
        className={`relative text-sm font-semibold tracking-[0.2em] uppercase transition-opacity duration-300 ${
          landed ? 'opacity-100' : 'opacity-80'
        }`}
      >
        {landed ? '✨ Đây rồi' : '🎲 Đang chọn'}
      </p>

      <div
        className="relative mt-6 w-full"
        style={{
          height: SLOT_HEIGHT,
          // Fades the names entering and leaving, so the strip reads as a wheel
          // rather than a list sliding under a window.
          maskImage: 'linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent)',
          WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent)',
        }}
      >
        <div
          onTransitionEnd={land}
          style={{
            transform: running || skipReel ? `translate3d(0, -${travel}px, 0)` : 'translate3d(0, 0, 0)',
            transition: skipReel
              ? undefined
              : `transform ${REEL_DURATION_MS}ms cubic-bezier(0.13, 0.72, 0.11, 1)`,
            willChange: 'transform',
          }}
        >
          {slots.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="flex items-center justify-center px-2"
              style={{ height: SLOT_HEIGHT }}
            >
              {/* Clamped to two lines: a third would spill into the next slot and
                  the reel would show two names at once. */}
              <span
                className={`line-clamp-2 text-2xl leading-tight font-extrabold text-balance sm:text-4xl ${
                  landed && index === slots.length - 1 ? 'spin-winner' : ''
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {landed && landedNote ? (
        <p className="relative mt-3 text-lg font-semibold opacity-85">{landedNote}</p>
      ) : null}

      {/* Announce only the final answer: narrating every reel frame would flood a
          screen reader with names that were never chosen. */}
      <p aria-live="polite" className="sr-only">
        {landed ? `Đã chọn ${winnerLabel}` : ''}
      </p>

      <p className="relative mt-6 text-sm opacity-75">
        {landed
          ? 'Đang mở kết quả…'
          : (waitingNote ?? `Đang cân nhắc ${candidates.length} lựa chọn hợp với bạn`)}
      </p>
    </div>
  );
}
