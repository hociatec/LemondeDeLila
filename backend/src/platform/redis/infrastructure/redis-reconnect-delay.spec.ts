import { redisReconnectDelay } from './redis-reconnect-delay';

it.each([1, 2, 3, 8, 100, Number.MAX_SAFE_INTEGER, 0, -1, NaN, Infinity])(
  'keeps retry %s within a bounded exponential jitter window',
  (attempt) => {
    const safe = Number.isSafeInteger(attempt) && attempt > 0 ? attempt : 1;
    const ceiling = Math.min(30_000, 200 * 2 ** Math.min(safe - 1, 8));
    for (let sample = 0; sample < 20; sample++) {
      const delay = redisReconnectDelay(attempt);
      expect(Number.isSafeInteger(delay)).toBe(true);
      expect(delay).toBeGreaterThanOrEqual(ceiling / 2);
      expect(delay).toBeLessThanOrEqual(ceiling);
    }
  },
);
