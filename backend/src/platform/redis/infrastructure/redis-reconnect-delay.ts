import { randomInt } from 'node:crypto';

/** Equal jitter prevents instances from reconnecting in lockstep after an outage. */
export function redisReconnectDelay(attempt: number): number {
  const safeAttempt =
    Number.isSafeInteger(attempt) && attempt > 0 ? attempt : 1;
  const ceiling = Math.min(30_000, 200 * 2 ** Math.min(safeAttempt - 1, 8));
  return randomInt(Math.floor(ceiling / 2), ceiling + 1);
}
