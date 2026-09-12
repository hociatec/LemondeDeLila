import type { RedisRateLimitStorage } from '../../../redis/public-api';
import { WsRequestRateLimitService } from './ws-request-rate-limit.service';
import { operationalSettings } from '../../../config/public-api';

it('shares a stable user budget across instances and keeps anonymous peers separate', async () => {
  const counts = new Map<string, number>();
  const increment = jest.fn(async (key: string) => {
    const hits = (counts.get(key) ?? 0) + 1;
    counts.set(key, hits);
    return { totalHits: hits, isBlocked: false };
  });
  const storage = { increment } as unknown as RedisRateLimitStorage;
  const runtimeConfig = { wsRateLimitCount: 2, wsRateLimitWindowMs: 10000 };
  const first = new WsRequestRateLimitService(storage, runtimeConfig);
  const second = new WsRequestRateLimitService(storage, runtimeConfig);
  expect(await first.allow(42, 'first-peer')).toBe(true);
  expect(await second.allow(42, 'second-peer')).toBe(true);
  expect(await first.allow(42, 'reconnected')).toBe(false);
  expect(await second.allow(43)).toBe(true);
  expect(await first.allow(null, 'peer-a')).toBe(true);
  expect(await second.allow(null, 'peer-a')).toBe(true);
  expect(await first.allow(null, 'peer-a')).toBe(false);
  expect(await first.allow(null, 'peer-b')).toBe(true);
  expect(increment).toHaveBeenCalledWith(
    expect.stringMatching(/^[a-f0-9]{64}$/),
    10000,
    2,
    10000,
    'ws',
  );
});

it('fails closed on Redis failure or an active block', async () => {
  const increment = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ totalHits: 1, isBlocked: true });
  const limiter = new WsRequestRateLimitService(
    { increment } as unknown as RedisRateLimitStorage,
    { wsRateLimitCount: 20, wsRateLimitWindowMs: 10_000 },
  );
  expect(await limiter.allow(42)).toBe(false);
  expect(await limiter.allow(42)).toBe(false);
});

it('shares a stricter authentication budget by peer across users and instances', async () => {
  const counts = new Map<string, number>();
  const storage = {
    increment: jest.fn(
      async (
        key: string,
        _ttl: number,
        limit: number,
        _block: number,
        namespace: string,
      ) => {
        const bucket = `${namespace}:${key}`;
        const totalHits = (counts.get(bucket) ?? 0) + 1;
        counts.set(bucket, totalHits);
        return {
          totalHits,
          isBlocked: totalHits > limit,
          timeToExpire: 60,
          timeToBlockExpire: 0,
        };
      },
    ),
  };
  const config = { wsRateLimitCount: 10_000, wsRateLimitWindowMs: 10_000 };
  const first = new WsRequestRateLimitService(storage, config);
  const second = new WsRequestRateLimitService(storage, config);
  for (
    let index = 0;
    index < operationalSettings.authRequestRateLimitCount;
    index++
  ) {
    const service = index % 2 === 0 ? first : second;
    expect(await service.allow(index + 1, 'same-peer', 'authentication')).toBe(
      true,
    );
  }
  expect(await second.allow(999, 'same-peer', 'authentication')).toBe(false);
  expect(await first.allow(null, 'another-peer', 'authentication')).toBe(true);
  expect(await first.allow(999, 'same-peer', 'standard')).toBe(true);
});
