'use client';

import { useEffect, useRef, useState } from 'react';
import { useCityPreference, writeCityPreference } from '@/lib/places/city-preference';
import type { City } from '@/lib/places/types';

/**
 * City selector, as a bottom sheet.
 *
 * A native `<select>` was the first attempt: it gives a good wheel on a phone for
 * free. But its option list is essentially unstylable, so on a desktop it dropped a
 * plain grey OS menu over the page and looked broken next to everything else — and
 * it could not show how many places each city has, which is the one fact that makes
 * the choice meaningful.
 *
 * `<dialog>` + `showModal()` is the right primitive: focus trapping, Escape to
 * close, inertness of the page behind, and a `::backdrop` all come from the
 * platform rather than from hand-rolled JavaScript that usually gets them wrong.
 *
 * The choice lives in the browser, not in the URL or on a server: which city you
 * are in is a property of you, not of the page.
 */

export type CityOption = { readonly city: City; readonly placeCount: number };

export function CityPicker({ options }: { options: readonly CityOption[] }) {
  const stored = useCityPreference();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // A stored city that no longer has places falls back to the first available one
  // rather than rendering an empty trigger.
  const selected = options.find((option) => option.city.id === stored) ?? options[0];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!selected) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/70 py-1.5 pr-3 pl-3 text-sm font-semibold ring-1 ring-line transition hover:ring-ink/20 active:scale-[0.97]"
      >
        <span aria-hidden>📍</span>
        {selected.city.shortName}
        <span aria-hidden className="text-xs text-ink-faint">
          ▾
        </span>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        // Clicking the backdrop closes: the click lands on the dialog element
        // itself only when it is outside the inner panel.
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="city-sheet m-0 mt-auto w-full max-w-lg bg-transparent p-0 backdrop:bg-ink/40 backdrop:backdrop-blur-sm sm:mx-auto sm:my-auto"
      >
        <div className="page-gutter rounded-t-card bg-cream pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-card sm:pb-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Bạn đang ở đâu?</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1 text-sm font-medium text-ink-faint hover:text-ink"
            >
              Đóng
            </button>
          </div>

          <ul className="mt-4 flex flex-col gap-1.5">
            {options.map(({ city, placeCount }) => {
              const isSelected = city.id === selected.city.id;
              return (
                <li key={city.id}>
                  <button
                    type="button"
                    onClick={() => {
                      writeCityPreference(city.id);
                      setOpen(false);
                    }}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.98] ${
                      isSelected
                        ? 'border-brand bg-white shadow-sm'
                        : 'border-transparent bg-white/60 hover:bg-white'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{city.name}</span>
                      <span className="block text-sm text-ink-faint">{placeCount} địa điểm</span>
                    </span>
                    {isSelected ? (
                      <span aria-hidden className="text-brand">
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>
    </>
  );
}
