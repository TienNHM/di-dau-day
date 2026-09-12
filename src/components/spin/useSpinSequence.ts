'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long the reel takes to travel its whole length and stop.
 *
 * 2.4s felt hurried: the deceleration is the part that reads as a decision being
 * made, and at that speed it was over before anyone could watch a name settle.
 */
export const REEL_DURATION_MS = 3600;
/**
 * Time the winner sits on screen before the result page takes over.
 *
 * Long enough to read the name and see the confetti land, and no longer — this is a
 * fifteen-second product, and the result page is where the user is actually going.
 */
const HOLD_MS = 1700;
const REDUCED_MOTION_MS = 400;
/**
 * If the reel's `transitionend` never arrives the flow would hang forever — it does
 * not fire on a hidden element, and a backgrounded tab can swallow it. The reveal is
 * decorative; being stuck on it is not, so a timer lands the spin regardless.
 */
const LANDING_GRACE_MS = 600;

export type SpinPhase = 'reeling' | 'landed';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Drives the reveal: the reel travels, decelerates, lands, holds, hands over.
 *
 * The deceleration is the whole trick — a constant-speed reel reads as a loading
 * spinner, while slowing into the answer reads as a decision being made. The motion
 * itself is a CSS transform so it runs on the compositor; this hook only owns *when*
 * the spin is over.
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
  const [phase, setPhase] = useState<SpinPhase>(() =>
    prefersReducedMotion() || stepCount <= 1 ? 'landed' : 'reeling',
  );

  const landedRef = useRef(false);
  const completeRef = useRef(onComplete);

  // Kept current in an effect rather than during render, so the spin holds the latest
  // callback without a re-render ever restarting the sequence.
  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  /** Called by the reel when it stops, and by the safety timer if it never does. */
  const land = useCallback(() => {
    if (landedRef.current) return;
    landedRef.current = true;
    setPhase('landed');

    // A short, quiet pattern. Vibration is unsupported on iOS Safari and can be
    // switched off system-wide, so it is a garnish on the reveal, never the signal.
    try {
      navigator.vibrate?.([14, 44, 22]);
    } catch {
      // Some browsers throw instead of returning false when the API is blocked.
    }
  }, []);

  useEffect(() => {
    // Skipping starts already landed, so the hold effect below is what finishes it.
    if (skipReel) {
      landedRef.current = true;
      return;
    }

    const safety = setTimeout(land, REEL_DURATION_MS + LANDING_GRACE_MS);
    return () => clearTimeout(safety);
  }, [skipReel, land]);

  // The single owner of `onComplete`: whichever way the spin ended, it ends here.
  useEffect(() => {
    if (phase !== 'landed') return;
    const timer = setTimeout(() => completeRef.current(), skipReel ? REDUCED_MOTION_MS : HOLD_MS);
    return () => clearTimeout(timer);
  }, [phase, skipReel]);

  return { phase, land, skipReel };
}
