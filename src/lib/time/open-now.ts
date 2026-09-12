import { WEEKDAYS } from '@/lib/places/types';
import type { OpeningHours, TimeRange, Weekday } from '@/lib/places/types';

/**
 * Opening-hours evaluation in Asia/Ho_Chi_Minh.
 *
 * The timezone is pinned rather than read from the device: a static site is
 * prerendered on a CI machine in UTC, and "mở cửa lúc này" must mean Saigon time
 * regardless of where the build ran or where the visitor's clock is set.
 */

export const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export type OpenState = 'open' | 'closed' | 'unknown';

const WEEKDAY_BY_SHORT_NAME: Record<string, Weekday> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

export type ZonedMoment = {
  readonly weekday: Weekday;
  /** Minutes since local midnight. */
  readonly minutes: number;
};

export function toZonedMoment(date: Date, timeZone: string = TIME_ZONE): ZonedMoment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekday = WEEKDAY_BY_SHORT_NAME[lookup('weekday')] ?? 'mon';
  // `hour12: false` can render midnight as "24" in some ICU versions.
  const hour = Number(lookup('hour')) % 24;
  const minute = Number(lookup('minute'));

  return { weekday, minutes: hour * 60 + minute };
}

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function previousWeekday(day: Weekday): Weekday {
  const index = WEEKDAYS.indexOf(day);
  return WEEKDAYS[(index + WEEKDAYS.length - 1) % WEEKDAYS.length] ?? 'mon';
}

/**
 * The schedule for one day: an explicit per-day entry wins, `default` fills in,
 * and `undefined` (neither set) means unknown — distinct from `[]`, which means
 * deliberately closed.
 */
function scheduleFor(hours: OpeningHours, day: Weekday): readonly TimeRange[] | undefined {
  return hours[day] ?? hours.default;
}

/** A range whose close is at or before its open runs past midnight into the next day. */
function isOvernight([open, close]: TimeRange): boolean {
  return toMinutes(close) <= toMinutes(open);
}

export function isOpenAt(
  hours: OpeningHours | undefined,
  date: Date = new Date(),
  timeZone: string = TIME_ZONE,
): OpenState {
  if (!hours) return 'unknown';

  const { weekday, minutes } = toZonedMoment(date, timeZone);

  const today = scheduleFor(hours, weekday);
  const yesterday = scheduleFor(hours, previousWeekday(weekday));

  if (today === undefined && yesterday === undefined) return 'unknown';

  for (const range of today ?? []) {
    const [open, close] = range;
    const openAt = toMinutes(open);
    if (isOvernight(range)) {
      if (minutes >= openAt) return 'open';
    } else if (minutes >= openAt && minutes < toMinutes(close)) {
      return 'open';
    }
  }

  // A range that started yesterday and runs past midnight still covers this morning.
  for (const range of yesterday ?? []) {
    if (isOvernight(range) && minutes < toMinutes(range[1])) return 'open';
  }

  return 'closed';
}

/** Human-readable hours for today, e.g. "07:00 – 22:00" or "Đóng cửa hôm nay". */
export function describeTodayHours(
  hours: OpeningHours | undefined,
  date: Date = new Date(),
  timeZone: string = TIME_ZONE,
): string | null {
  if (!hours) return null;

  const { weekday } = toZonedMoment(date, timeZone);
  const today = scheduleFor(hours, weekday);

  if (today === undefined) return null;
  if (today.length === 0) return 'Đóng cửa hôm nay';

  return today.map(([open, close]) => `${open} – ${close}`).join(', ');
}
