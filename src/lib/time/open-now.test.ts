import { describe, expect, it } from 'vitest';
import { describeTodayHours, isOpenAt } from './open-now';

/**
 * Reference moments, expressed in UTC so the test is explicit about the offset it
 * expects (Asia/Ho_Chi_Minh is UTC+7, no DST).
 */
const MONDAY_09_00 = new Date('2026-09-14T02:00:00Z');
const MONDAY_23_30 = new Date('2026-09-14T16:30:00Z');
const TUESDAY_01_00 = new Date('2026-09-14T18:00:00Z');

describe('isOpenAt', () => {
  it('reports unknown when there are no hours at all', () => {
    expect(isOpenAt(undefined, MONDAY_09_00)).toBe('unknown');
    expect(isOpenAt({}, MONDAY_09_00)).toBe('unknown');
  });

  it('uses Saigon time rather than the machine timezone', () => {
    // 02:00 UTC is 09:00 in Saigon — inside the range, despite being outside it in UTC.
    expect(isOpenAt({ default: [['07:00', '22:00']] }, MONDAY_09_00)).toBe('open');
  });

  it('closes outside the range', () => {
    expect(isOpenAt({ default: [['18:00', '22:00']] }, MONDAY_09_00)).toBe('closed');
  });

  it('lets a per-day entry override the default', () => {
    const hours = { default: [['07:00', '22:00']], mon: [['18:00', '22:00']] } as const;
    expect(isOpenAt(hours, MONDAY_09_00)).toBe('closed');
  });

  it('treats an explicit empty day as closed, not unknown', () => {
    expect(isOpenAt({ default: [['07:00', '22:00']], mon: [] }, MONDAY_09_00)).toBe('closed');
  });

  it('handles a lunch break between two ranges', () => {
    const hours = {
      default: [
        ['07:00', '11:00'],
        ['16:00', '21:00'],
      ],
    } as const;
    expect(isOpenAt(hours, MONDAY_09_00)).toBe('open');
    expect(isOpenAt(hours, MONDAY_23_30)).toBe('closed');
  });

  describe('past midnight', () => {
    const hours = { default: [['18:00', '02:00']] } as const;

    it('is open late on the evening the range starts', () => {
      expect(isOpenAt(hours, MONDAY_23_30)).toBe('open');
    });

    it('is still open in the small hours of the next day', () => {
      expect(isOpenAt(hours, TUESDAY_01_00)).toBe('open');
    });

    it('is closed once the range has ended', () => {
      expect(isOpenAt(hours, MONDAY_09_00)).toBe('closed');
    });
  });

  it('does not carry an overnight range across a day that is explicitly closed', () => {
    // Closed Monday, so Tuesday 01:00 must not inherit Monday's overnight range.
    const hours = { default: [['18:00', '02:00']], mon: [] } as const;
    expect(isOpenAt(hours, TUESDAY_01_00)).toBe('closed');
  });
});

describe('describeTodayHours', () => {
  it('returns null when hours are unknown', () => {
    expect(describeTodayHours(undefined, MONDAY_09_00)).toBeNull();
  });

  it('formats a single range', () => {
    expect(describeTodayHours({ default: [['07:00', '22:00']] }, MONDAY_09_00)).toBe(
      '07:00 – 22:00',
    );
  });

  it('joins split ranges', () => {
    const hours = {
      default: [
        ['07:00', '11:00'],
        ['16:00', '21:00'],
      ],
    } as const;
    expect(describeTodayHours(hours, MONDAY_09_00)).toBe('07:00 – 11:00, 16:00 – 21:00');
  });

  it('says so when the place is closed today', () => {
    expect(describeTodayHours({ default: [['07:00', '22:00']], mon: [] }, MONDAY_09_00)).toBe(
      'Đóng cửa hôm nay',
    );
  });
});
