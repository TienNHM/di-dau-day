'use client';

import { useEffect, useState } from 'react';

/** How many names flick past before the reel settles. */
const REEL_STEPS = 14;
const FIRST_DELAY_MS = 60;
const FINAL_DELAY_MS = 280;
/** Time the winner sits on screen before the result page takes over. */
const HOLD_MS = 700;
const REDUCED_MOTION_MS = 400;

export type SpinPhase = 'reeling' | 'landed';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Drives the reveal: names flick past, decelerate, land on the winner, hold, done.
 *
 * The deceleration is the whole trick — a constant-speed reel reads as a loading
 * spinner, while slowing into the answer reads as a decision being made.
 *
 * Under `prefers-reduced-motion` the reel is skipped entirely rather than merely
 * shortened: the animation is decorative, and the result is the point. That is
 * decided in the initial state rather than in an effect, so the reduced-motion path
 * never renders a frame of the reel it is meant to suppress.
 */
export function useSpinSequence({
  stepCount,
  onComplete,
}: {
  stepCount: number;
  onComplete: () => void;
}) {
  const [skipReel] = useState(() => prefersReducedMotion() || stepCount <= 1);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<SpinPhase>(() =>
    prefersReducedMotion() || stepCount <= 1 ? 'landed' : 'reeling',
  );

  useEffect(() => {
    if (skipReel) {
      const timer = setTimeout(onComplete, REDUCED_MOTION_MS);
      return () => clearTimeout(timer);
    }

    let timer: ReturnType<typeof setTimeout>;
    let step = 0;

    const tick = () => {
      step += 1;
      setIndex((current) => current + 1);

      if (step >= REEL_STEPS) {
        setPhase('landed');
        timer = setTimeout(onComplete, HOLD_MS);
        return;
      }

      const progress = step / REEL_STEPS;
      timer = setTimeout(tick, FIRST_DELAY_MS + progress ** 2 * (FINAL_DELAY_MS - FIRST_DELAY_MS));
    };

    timer = setTimeout(tick, FIRST_DELAY_MS);
    return () => clearTimeout(timer);
    // A spin is a one-shot sequence: re-running it when `onComplete` changes identity
    // would restart the reel underneath the user mid-animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipReel]);

  return { index, phase };
}
