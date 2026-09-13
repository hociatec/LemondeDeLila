import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { RedisClientFactory } from './redis-client.factory';
import { RedisDistributedLeaseService } from './redis-distributed-lease.service';

function createFactory() {
  const factory: RedisClientFactory = Object.create(
    RedisClientFactory.prototype,
  );
  const client = { disconnect: jest.fn() } as Redis;
  const create = jest.spyOn(factory, 'create').mockReturnValue(client);
  return { factory, create };
}

it('uses the dedicated update Redis URL when configured', () => {
  const config = new ConfigService({
    NODE_ENV: 'production',
    UPDATE_REDIS_URL: 'redis://updates:6379/3',
    REDIS_URL: 'redis://default:6379/0',
    SESSION_STORE_REDIS_URL: 'redis://sessions:6379/1',
  });
  const { factory, create } = createFactory();

  new RedisDistributedLeaseService(config, factory);

  expect(create).toHaveBeenCalledWith(
    'redis://updates:6379/3',
    'distributed-lease',
  );
});

it('falls back to the session Redis used by production when update URLs are absent', () => {
  const config = new ConfigService({
    NODE_ENV: 'production',
    UPDATE_REDIS_URL: '',
    SESSION_STORE_REDIS_URL: 'redis://sessions:6379/1',
  });
  const { factory, create } = createFactory();

  new RedisDistributedLeaseService(config, factory);

  expect(create).toHaveBeenCalledWith(
    'redis://sessions:6379/1',
    'distributed-lease',
  );
});
