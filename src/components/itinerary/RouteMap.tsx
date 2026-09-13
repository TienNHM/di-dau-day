import { haversineKm } from '@/lib/geo/haversine';
import { accentFor } from '@/lib/intents/accents';
import type { Category } from '@/lib/places/types';

/**
 * The shape of the route, drawn from its own coordinates.
 *
 * No tiles and no map provider. Every option needs an API key, and a key in a static
 * site is a public key — Mapbox and Google both bill against it, and anyone reading
 * the page source can spend the owner's money. OpenStreetMap's own tiles are free but
 * their usage policy rules out exactly this. Tiles would also be the heaviest thing on
 * a page that otherwise ships no images at all.
 *
 * So this is a diagram, not a map: where the stops sit relative to each other, in what
 * order, and how far apart. That is the question the picture is being asked — "is this
 * a tight loop or a trek across town" — and it answers it in about two kilobytes.
 * Anyone who wants real streets has the Google Maps button underneath.
 */

export type RoutePoint = {
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly category: Category;
};

const WIDTH = 320;
const HEIGHT = 200;
const PADDING = 26;
const MARKER_RADIUS = 12;
/** Two radii plus a hair, so touching markers still read as two. */
const MIN_MARKER_GAP = MARKER_RADIUS * 2 + 3;

export function RouteMap({ points }: { points: readonly RoutePoint[] }) {
  if (points.length < 2) return null;

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  /*
   * Longitude is compressed by the cosine of the latitude — at 10°N a degree of
   * longitude is about 98% of a degree of latitude. Ignoring it would stretch the
   * route east-west and misrepresent which legs are actually the long ones.
   */
  const midLat = (minLat + maxLat) / 2;
  const scaleLng = Math.cos((midLat * Math.PI) / 180);

  const spanLat = Math.max(maxLat - minLat, 1e-6);
  const spanLng = Math.max((maxLng - minLng) * scaleLng, 1e-6);

  // One scale for both axes, so the drawing keeps the route's real proportions
  // rather than filling the box.
  const scale = Math.min((WIDTH - PADDING * 2) / spanLng, (HEIGHT - PADDING * 2) / spanLat);
  const offsetX = (WIDTH - spanLng * scale) / 2;
  const offsetY = (HEIGHT - spanLat * scale) / 2;

  const projected = points.map((point) => ({
    ...point,
    x: offsetX + (point.lng - minLng) * scaleLng * scale,
    // SVG y grows downward; latitude grows north. Flip it or the route is upside down.
    y: HEIGHT - offsetY - (point.lat - minLat) * scale,
  }));

  /*
   * Nudge markers apart when they would sit on top of each other.
   *
   * Two stops a few hundred metres apart land within a few pixels here, and the later
   * one simply covered the earlier — a five-stop route drew four markers, which reads
   * as a bug rather than as "these two are close". A few relaxation passes separate
   * them by a marker's width while leaving the overall shape intact.
   */
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;

    for (let a = 0; a < projected.length; a += 1) {
      for (let b = a + 1; b < projected.length; b += 1) {
        const first = projected[a]!;
        const second = projected[b]!;
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        if (distance >= MIN_MARKER_GAP) continue;

        // Identical coordinates have no direction to separate along, so pick one.
        const ux = distance < 0.05 ? 1 : dx / distance;
        const uy = distance < 0.05 ? 0 : dy / distance;
        const push = (MIN_MARKER_GAP - distance) / 2;

        first.x -= ux * push;
        first.y -= uy * push;
        second.x += ux * push;
        second.y += uy * push;
        moved = true;
      }
    }

    if (!moved) break;
  }

  // Relaxation can push a marker past the edge; pull it back inside the frame.
  for (const point of projected) {
    point.x = Math.min(WIDTH - MARKER_RADIUS - 2, Math.max(MARKER_RADIUS + 2, point.x));
    point.y = Math.min(HEIGHT - MARKER_RADIUS - 2, Math.max(MARKER_RADIUS + 2, point.y));
  }

  const totalKm = points
    .slice(1)
    .reduce((sum, point, index) => sum + haversineKm(points[index]!, point), 0);

  const path = projected.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  return (
    <figure className="overflow-hidden rounded-card bg-white/70 ring-1 ring-line">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Sơ đồ lộ trình ${points.length} điểm, tổng khoảng ${totalKm.toFixed(1)} km`}
      >
        <polyline
          points={path}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={2}
          strokeDasharray="5 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {projected.map((point, index) => {
          const accent = accentFor(point.category);
          return (
            <g key={`${point.name}-${index}`}>
              {/* A ring in the page colour, so overlapping markers read as stacked
                  discs rather than as one smudge. */}
              <circle
                cx={point.x}
                cy={point.y}
                r={MARKER_RADIUS}
                fill={accent.from}
                stroke="var(--color-cream)"
                strokeWidth={2.5}
              />
              <text
                x={point.x}
                y={point.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={800}
                fill={accent.on}
              >
                {index + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="border-t border-line px-4 py-2.5 text-center text-xs text-ink-faint">
        Sơ đồ tương đối · tổng khoảng {totalKm < 1 ? '<1' : totalKm.toFixed(1)} km
      </figcaption>
    </figure>
  );
}

/**
 * One link that opens the whole route in Google Maps, stops in order.
 *
 * Coordinates rather than names: a name search can land on the wrong branch of a
 * chain, and the point of a route is that each stop is the one we actually chose.
 */
export function routeDirectionsUrl(points: readonly RoutePoint[]): string | null {
  if (points.length < 2) return null;

  const at = (point: RoutePoint) => `${point.lat},${point.lng}`;
  const params = new URLSearchParams({
    api: '1',
    origin: at(points[0]!),
    destination: at(points[points.length - 1]!),
    travelmode: 'driving',
  });

  const waypoints = points.slice(1, -1);
  if (waypoints.length > 0) params.set('waypoints', waypoints.map(at).join('|'));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
