import {
  parseUserBanUntil,
  userBanStatus,
  userBanUntilAfterDays,
} from './user-ban.policy';

it('uses one expiry boundary and refuses corrupt dates', () => {
  expect(userBanStatus(null, 1000)).toBe('none');
  expect(userBanStatus(undefined, 1000)).toBe('none');
  expect(userBanStatus(new Date(1001), 1000)).toBe('active');
  expect(userBanStatus(new Date(1000), 1000)).toBe('expired');
  expect(userBanStatus(new Date(999), 1000)).toBe('expired');
  expect(userBanStatus(new Date(NaN), 1000)).toBe('invalid');
});

it('requires a real date and an explicit timezone for date-times', () => {
  expect(parseUserBanUntil('2026-09-08').toISOString()).toBe(
    '2026-09-08T00:00:00.000Z',
  );
  expect(parseUserBanUntil('2026-09-08T02:00:00+02:00').toISOString()).toBe(
    '2026-09-08T00:00:00.000Z',
  );
  for (const value of [
    '',
    'invalid',
    '2026-02-30',
    '2026-09-08T12:00:00',
    '2026-13-01',
  ])
    expect(() => parseUserBanUntil(value)).toThrow(RangeError);
});

it('uses elapsed 24-hour days and rejects unbounded durations', () => {
  const start = Date.parse('2026-03-28T12:00:00Z');
  expect(userBanUntilAfterDays(1, start).getTime() - start).toBe(86_400_000);
  for (const days of [0, -1, 1.5, NaN, Infinity, 36501])
    expect(() => userBanUntilAfterDays(days, start)).toThrow(RangeError);
});
