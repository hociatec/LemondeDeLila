import { GameRecoveryBackoff } from './game-recovery-backoff';

it('retains deferred sessions seen in a sweep, and forgets missing sessions only at its end', () => {
  const backoff = new GameRecoveryBackoff(() => 0);
  const retained = { roomId: 1, gameType: 'retained' };
  const removed = { roomId: 2, gameType: 'removed' };
  backoff.failed(retained);
  backoff.failed(removed);
  backoff.completeSweep();
  expect(backoff.size).toBe(2);
  expect(backoff.shouldRetry(retained)).toBe(false);
  expect(backoff.size).toBe(2);
  backoff.completeSweep();
  expect(backoff.size).toBe(1);
  expect(backoff.shouldRetry(removed)).toBe(true);
  expect(backoff.failed(retained)).toBe(10_000);
  expect(backoff.failed(removed)).toBe(5_000);
});

it('backs off to five minutes, then retries and clears recovered sessions', () => {
  let now = 0;
  const backoff = new GameRecoveryBackoff(() => now);
  const key = { roomId: 1, gameType: 'missing' };
  for (const delay of [
    5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000,
  ]) {
    expect(backoff.shouldRetry(key)).toBe(true);
    expect(backoff.failed(key)).toBe(delay);
    expect(backoff.shouldRetry(key)).toBe(false);
    now += delay;
  }
  backoff.recovered(key);
  expect(backoff.size).toBe(0);
  expect(backoff.failed(key)).toBe(5_000);
});

it('bounds memory without deleting durable sessions or blocking other games', () => {
  const backoff = new GameRecoveryBackoff(() => 0);
  for (let roomId = 1; roomId <= 10_001; roomId++)
    backoff.failed({ roomId, gameType: 'bad' });
  expect(backoff.size).toBe(10_000);
  expect(backoff.shouldRetry({ roomId: 10_001, gameType: 'good' })).toBe(true);
  expect(backoff.shouldRetry({ roomId: 1, gameType: 'bad' })).toBe(true);
});
