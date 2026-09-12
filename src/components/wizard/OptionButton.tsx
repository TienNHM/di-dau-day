'use client';

import type { ReactNode } from 'react';

/**
 * One answer.
 *
 * Deliberately large: this is a thumb target on a phone held one-handed, and the
 * whole promise is a result in fifteen seconds — a mis-tap costs more than the
 * vertical space a generous target uses.
 */
export function OptionButton({
  selected,
  onSelect,
  emoji,
  label,
  hint,
  accentFrom,
}: {
  selected: boolean;
  onSelect: () => void;
  emoji?: ReactNode;
  label: string;
  hint?: string;
  accentFrom: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-left transition duration-200 active:scale-[0.98] ${
        selected
          ? 'border-transparent bg-white shadow-md shadow-ink/5'
          : 'border-line bg-white/60 hover:border-ink/15 hover:bg-white'
      }`}
      style={selected ? { borderColor: accentFrom } : undefined}
    >
      {emoji ? (
        <span aria-hidden className="text-2xl">
          {emoji}
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint ? <span className="block text-sm text-ink-faint">{hint}</span> : null}
      </span>

      <span
        aria-hidden
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold text-white transition ${
          selected ? 'border-transparent' : 'border-line'
        }`}
        style={selected ? { backgroundColor: accentFrom } : undefined}
      >
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}
