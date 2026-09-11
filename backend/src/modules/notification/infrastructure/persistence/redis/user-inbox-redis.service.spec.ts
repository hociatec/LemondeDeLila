import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisClientFactory } from '../../../../../platform/redis/public-api';
import { UserInboxRedisService } from './user-inbox-redis.service';

function setup() {
  const redis = new Redis({ lazyConnect: true });
  const connect = jest.spyOn(redis, 'connect').mockResolvedValue();
  const transaction = redis.multi();
  const zadd = jest.spyOn(transaction, 'zadd');
  jest.spyOn(transaction, 'exec').mockResolvedValue([]);
  const multi = jest.spyOn(redis, 'multi').mockReturnValue(transaction);
  jest.spyOn(redis, 'zcard').mockResolvedValue(1);
  const factory = new RedisClientFactory();
  jest.spyOn(factory, 'create').mockReturnValue(redis);
  const service = new UserInboxRedisService(
    new ConfigService({ NOTIFICATION_REDIS_URL: 'redis://localhost' }),
    factory,
  );
  return { service, redis, connect, multi, zadd };
}

it.each(['', 'invalid', '2026-09-11T12:00:00'])(
  'rejects invalid or timezone-less instant %s before touching Redis',
  async (createdAt) => {
    const { service, redis, connect, multi } = setup();
    try {
      await expect(
        service.add(1, { id: 'notice', kind: 'test', createdAt }),
      ).rejects.toThrow(RangeError);
      expect(connect).not.toHaveBeenCalled();
      expect(multi).not.toHaveBeenCalled();
    } finally {
      redis.disconnect();
    }
  },
);

it.each(['1970-01-01T00:00:00.000Z', '1970-01-01T01:00:00+01:00'])(
  'preserves epoch zero in inbox ordering for %s',
  async (createdAt) => {
    const { service, redis, zadd } = setup();
    try {
      await service.add(1, { id: 'notice', kind: 'test', createdAt });
      expect(zadd).toHaveBeenCalledWith('notify:inbox:1:order', 0, 'notice');
    } finally {
      redis.disconnect();
    }
  },
);
