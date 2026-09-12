'use client';

import { useCityPreference, writeCityPreference } from '@/lib/places/city-preference';
import type { City } from '@/lib/places/types';

/**
 * City selector.
 *
 * The choice lives in the browser, not in the URL or on a server: which city you
 * are in is a property of you, not of the page, and a returning visitor should not
 * be asked twice.
 *
 * Rendered as a real `<select>` rather than a custom dropdown — the native picker
 * on a phone is a full-height wheel that beats anything reimplemented in a div, and
 * it is accessible for free.
 */
export function CityPicker({ cities }: { cities: readonly City[] }) {
  const stored = useCityPreference();

  // A stored city that no longer has places (or never did) falls back to the first
  // available one rather than rendering an empty picker.
  const selected = cities.find((city) => city.id === stored) ?? cities[0];
  if (!selected) return null;

  return (
    <label className="inline-flex items-center gap-1.5 rounded-full bg-white/70 py-1.5 pr-2.5 pl-3 text-sm font-semibold ring-1 ring-line transition hover:ring-ink/15">
      <span aria-hidden>📍</span>
      <span className="sr-only">Chọn thành phố</span>
      <select
        value={selected.id}
        onChange={(event) => writeCityPreference(event.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-4 font-semibold outline-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath fill='%236b5d54' d='M1 1.5 6 6.5l5-5'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0 center',
          backgroundSize: '0.6rem',
        }}
      >
        {cities.map((city) => (
          <option key={city.id} value={city.id}>
            {city.shortName}
          </option>
        ))}
      </select>
    </label>
  );
}
