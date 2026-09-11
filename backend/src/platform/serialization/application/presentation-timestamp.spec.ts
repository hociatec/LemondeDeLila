import { presentationTimestamp } from './presentation-timestamp';

it('uses exactly the supplied instant, including epoch zero', () => {
  const clock = jest.fn(() => 0);
  expect(presentationTimestamp(clock)).toBe('1970-01-01T00:00:00.000Z');
  expect(clock).toHaveBeenCalledTimes(1);
});

it.each([NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER])(
  'rejects an invalid clock value %s without reading the system clock',
  (value) => {
    const systemClock = jest.spyOn(Date, 'now');
    try {
      expect(() => presentationTimestamp(() => value)).toThrow(RangeError);
      expect(systemClock).not.toHaveBeenCalled();
    } finally {
      systemClock.mockRestore();
    }
  },
);
