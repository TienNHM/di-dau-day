import type { ReactNode } from 'react';

/** Small pill used for metadata: location, price, duration, badges. */
export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'sponsored';
}) {
  const tones = {
    neutral: 'bg-white/70 text-ink-soft ring-line',
    brand: 'bg-brand-soft text-brand-deep ring-brand/20',
    sponsored: 'bg-sun/15 text-ink ring-sun/40',
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
