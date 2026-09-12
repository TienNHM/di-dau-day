import { Chip } from '@/components/ui/Chip';
import type { Accent } from '@/lib/intents/registry';
import { isSponsorshipActive } from '@/lib/places/types';
import type { District, Place } from '@/lib/places/types';
import { describeTodayHours, isOpenAt } from '@/lib/time/open-now';

/**
 * The hero, and the most important surface in the product.
 *
 * It has to survive being screenshotted and posted with no surrounding page, so
 * everything needed to act on it — name, area, price, duration — is inside the
 * gradient, at a size that stays legible after a messaging app recompresses it.
 *
 * No photography by design: we have no rights to photos of these places, and a
 * confident type-and-gradient card stands out on a feed more than stock imagery.
 */
export function ResultCard({
  place,
  district,
  accent,
  lead,
  now,
}: {
  place: Place;
  district: District | null;
  accent: Accent;
  lead: string;
  now?: Date;
}) {
  const openState = isOpenAt(place.openingHours, now);
  const todayHours = describeTodayHours(place.openingHours, now);
  const sponsored = isSponsorshipActive(place.sponsored, now);

  return (
    <article
      className="relative overflow-hidden rounded-card px-6 py-9 text-center"
      style={{
        backgroundImage: `linear-gradient(160deg, ${accent.from}, ${accent.to})`,
        color: accent.on,
      }}
    >
      {/* Soft highlight so the flat gradient reads as a surface rather than a swatch. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.55), transparent 60%)',
        }}
      />

      <div className="relative">
        <p className="text-xs font-semibold tracking-[0.22em] uppercase opacity-80">{lead}</p>

        <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl">
          {place.name}
        </h1>

        {place.editorialNote ? (
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-balance opacity-90">
            {place.editorialNote}
          </p>
        ) : null}

        <dl className="mt-7 flex flex-wrap justify-center gap-2">
          {district ? <Fact label="Khu vực">📍 {district.shortName}</Fact> : null}
          {place.avgPrice !== undefined ? (
            <Fact label="Giá">💰 {formatPrice(place.avgPrice)}</Fact>
          ) : null}
          {place.durationMinutes ? (
            <Fact label="Thời lượng">⏱ {formatDuration(place.durationMinutes)}</Fact>
          ) : null}
          {place.rating !== undefined ? <Fact label="Đánh giá">⭐ {place.rating}</Fact> : null}
        </dl>

        {openState !== 'unknown' ? (
          <p className="mt-5 text-sm font-medium opacity-90">
            {openState === 'open' ? '🟢 Đang mở cửa' : '🔴 Đang đóng cửa'}
            {todayHours ? ` · hôm nay ${todayHours}` : ''}
          </p>
        ) : null}

        {sponsored ? (
          <p className="mt-5">
            <Chip tone="sponsored">📣 {place.sponsored?.label ?? 'Được tài trợ'}</Chip>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-full bg-white/20 px-3.5 py-1.5 text-sm font-semibold backdrop-blur-sm">
      <dt className="sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** "~150K" — the shorthand people actually use when talking about prices here. */
export function formatPrice(vnd: number): string {
  if (vnd === 0) return 'Miễn phí';
  if (vnd < 1000) return `~${vnd}đ`;
  if (vnd < 1_000_000) return `~${Math.round(vnd / 1000)}K`;
  return `~${(vnd / 1_000_000).toFixed(1).replace('.', ',')}tr`;
}

/**
 * "45 phút", "2 giờ", "2,5 giờ" — rounded to the nearest half hour.
 *
 * Nobody plans an evening to the minute, and "2 giờ 20 phút" reads as false
 * precision for a number that is an editorial estimate in the first place.
 */
export function formatDuration([min, max]: readonly [number, number]): string {
  const toText = (minutes: number) => {
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.round(minutes / 30) / 2;
    return `${String(hours).replace('.', ',')} giờ`;
  };

  return min === max ? `~${toText(max)}` : `${toText(min)} – ${toText(max)}`;
}
