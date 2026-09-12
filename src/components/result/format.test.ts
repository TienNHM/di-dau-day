import { describe, expect, it } from 'vitest';
import { formatDuration, formatPrice } from './ResultCard';

describe('formatPrice', () => {
  it('says free rather than "~0đ"', () => {
    expect(formatPrice(0)).toBe('Miễn phí');
  });

  it('uses the K shorthand people actually speak', () => {
    expect(formatPrice(150000)).toBe('~150K');
    expect(formatPrice(68000)).toBe('~68K');
  });

  it('switches to triệu above a million, with a Vietnamese decimal comma', () => {
    expect(formatPrice(1_200_000)).toBe('~1,2tr');
  });
});

describe('formatDuration', () => {
  it('keeps sub-hour spans in minutes', () => {
    expect(formatDuration([30, 45])).toBe('30 phút – 45 phút');
  });

  it('drops the decimal on whole hours', () => {
    expect(formatDuration([120, 240])).toBe('2 giờ – 4 giờ');
  });

  it('rounds to the nearest half hour', () => {
    expect(formatDuration([90, 150])).toBe('1,5 giờ – 2,5 giờ');
    // 140 minutes is 2h20; a half-hour grid is the right precision for an estimate.
    expect(formatDuration([140, 140])).toBe('~2,5 giờ');
  });

  it('never reports a bare ",5" for an hour count it did not round', () => {
    // The earlier implementation floored the hours and always appended ",5",
    // so 3h05 rendered as "3,5 giờ" — overstating by nearly half an hour.
    expect(formatDuration([185, 185])).toBe('~3 giờ');
  });

  it('collapses an identical range into a single figure', () => {
    expect(formatDuration([60, 60])).toBe('~1 giờ');
  });
});
