import type { ReactNode } from 'react';

/**
 * One column, phone-first, centred on wide screens.
 *
 * Side padding is set once here rather than per component, which is what keeps the
 * 16px minimum gutter intact at every width without each screen re-deriving it.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="page-gutter mx-auto flex min-h-dvh w-full max-w-lg flex-col py-[max(1.5rem,env(safe-area-inset-top))]">
      {children}
    </div>
  );
}
