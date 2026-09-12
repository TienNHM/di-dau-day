'use client';

import { useMemo } from 'react';
import type { Accent } from '@/lib/intents/registry';

/**
 * The burst when the reel lands.
 *
 * DOM elements with one CSS animation each, not a canvas: thirty absolutely
 * positioned spans cost nothing next to shipping a particle library, and they stop
 * on their own when the animation ends. Nothing here is interactive or announced —
 * it is decoration, and `prefers-reduced-motion` removes it entirely.
 */

const PIECES = 30;

/** Seeded so the burst is identical on server and client, and never re-randomises. */
function scatter(index: number) {
  // A cheap deterministic hash. Math.random() here would differ between the render
  // that mounts this and any re-render, making pieces jump mid-flight.
  const noise = (seed: number) => ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;

  return {
    // One lane each, then jittered inside it. Pure noise clumped the pieces down one
    // side of the card and left the other half empty. The 4–92% range keeps the
    // widest piece clear of both edges, where it would be sliced by the card's
    // overflow and read as a rendering fault rather than as paper.
    left: 4 + ((index + 0.5) / PIECES) * 88 + (noise(index * 1.7) - 0.5) * (88 / PIECES),
    delay: noise(index * 3.1) * 220,
    duration: 900 + noise(index * 5.3) * 700,
    drift: (noise(index * 7.9) - 0.5) * 160,
    spin: (noise(index * 11.3) - 0.5) * 900,
    size: 6 + noise(index * 13.7) * 8,
    round: noise(index * 17.1) > 0.6,
  };
}

export function Confetti({ accent }: { accent: Accent }) {
  const pieces = useMemo(() => Array.from({ length: PIECES }, (_, index) => scatter(index)), []);
  const colours = [accent.on, '#ffffff', '#ffd76e', '#ff8a5c'];

  return (
    <div aria-hidden className="confetti-layer">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 1.6,
            backgroundColor: colours[index % colours.length],
            borderRadius: piece.round ? '50%' : '2px',
            animationDelay: `${piece.delay}ms`,
            animationDuration: `${piece.duration}ms`,
            ['--drift' as string]: `${piece.drift}px`,
            ['--spin' as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
