import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { RedisClientFactory } from './redis-client.factory';
import { RedisDistributedLeaseService } from './redis-distributed-lease.service';
import { prometheusMetrics } from '../../observability/public-api';

function fixture() {
  let owner = '';
  const client = {
    set: jest.fn(async (_key: string, token: string) => {
      owner = token;
      return 'OK';
    }),
    get: jest.fn(async () => owner),
    eval: jest.fn(async () => 1),
    disconnect: jest.fn(),
  };
  const factory: RedisClientFactory = Object.create(
    RedisClientFactory.prototype,
  );
  jest.spyOn(factory, 'create').mockReturnValue(client as unknown as Redis);
  const service = new RedisDistributedLeaseService(
    new ConfigService({ REDIS_URL: 'redis://localhost' }),
    factory,
  );
  return { service, client, factory };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(prometheusMetrics.leases, 'lose').mockImplementation(() => {});
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('irreversibly loses ownership on renewal failure and stops renewing', async () => {
  const { service, client } = fixture();
  const lease = (await service.acquire('lock', 6_000))!;
  client.eval.mockRejectedValueOnce(new Error('redis://secret:password@host'));
  await jest.advanceTimersByTimeAsync(2_000);
  expect(await lease.isHeld()).toBe(false);
  expect(prometheusMetrics.leases.lose).toHaveBeenCalledTimes(1);
  expect(client.get).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  expect(Logger.prototype.warn).not.toHaveBeenCalledWith(
    expect.stringContaining('secret'),
  );
  await lease.release();
  expect(prometheusMetrics.leases.lose).toHaveBeenCalledTimes(1);
});

it('fails closed on owner replacement and failed ownership reads', async () => {
  for (const failure of ['replacement', 'connection']) {
    const { service, client } = fixture();
    const lease = (await service.acquire('lock', 6_000))!;
    if (failure === 'replacement')
      client.get.mockResolvedValueOnce('another-owner');
    else client.get.mockRejectedValueOnce(new Error('offline'));
    expect(await lease.isHeld()).toBe(false);
    expect(await lease.isHeld()).toBe(false);
    expect(client.get).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
  }
});

it('does not overlap renewals or revive an expired lease after a delayed response', async () => {
  const { service, client } = fixture();
  const lease = (await service.acquire('lock', 6_000))!;
  let resolve!: (value: number) => void;
  client.eval.mockImplementationOnce(
    () =>
      new Promise<number>((done) => {
        resolve = done;
      }),
  );
  await jest.advanceTimersByTimeAsync(4_000);
  expect(client.eval).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(2_001);
  resolve(1);
  await Promise.resolve();
  expect(await lease.isHeld()).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

it('renews within its deadline, releases only its token and releases once', async () => {
  const { service, client } = fixture();
  const lease = (await service.acquire('lock', 6_000))!;
  await jest.advanceTimersByTimeAsync(8_000);
  expect(await lease.isHeld()).toBe(true);
  const token = client.set.mock.calls[0][1];
  await lease.release();
  const calls = client.eval.mock.calls.length;
  await lease.release();
  expect(client.eval).toHaveBeenCalledTimes(calls);
  expect(client.eval).toHaveBeenLastCalledWith(
    expect.stringContaining("redis.call('GET'"),
    1,
    'lock',
    token,
  );
  expect(await lease.isHeld()).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  expect(prometheusMetrics.leases.lose).not.toHaveBeenCalled();
});

it('invalidates every active lease and timer on shutdown', async () => {
  const { service, client } = fixture();
  const a = (await service.acquire('a', 6_000))!;
  const b = (await service.acquire('b', 6_000))!;
  service.onModuleDestroy();
  expect(await a.isHeld()).toBe(false);
  expect(await b.isHeld()).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  expect(client.disconnect).toHaveBeenCalledTimes(1);
  expect(prometheusMetrics.leases.lose).not.toHaveBeenCalled();
  await expect(service.acquire('c', 6_000)).rejects.toThrow('arrete');
});

it('distinguishes missing configuration from contention in every environment', async () => {
  const { factory, service, client } = fixture();
  for (const NODE_ENV of ['production', 'test', 'development']) {
    const missing = new RedisDistributedLeaseService(
      new ConfigService({ NODE_ENV }),
      factory,
    );
    await expect(missing.acquire('lock', 6_000)).rejects.toThrow('Redis');
  }
  client.set.mockResolvedValueOnce(null as never);
  expect(await service.acquire('lock', 6_000)).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
});
