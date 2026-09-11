import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import { RedisRefreshTokenService } from './redis-refresh-token.service';

function setup() {
  const redis = {
    eval: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  const factory = {
    create: jest.fn().mockReturnValue(redis),
  } as unknown as RedisClientFactory;
  const service = new RedisRefreshTokenService(
    new ConfigService({
      SESSION_STORE_REDIS_URL: 'redis://localhost',
      REFRESH_TOKEN_TTL_SECONDS: 3600,
    }),
    factory,
  );
  return { service, redis };
}

it('stores only a token digest with expiry and revokes that digest', async () => {
  const { service, redis } = setup();
  const token = await service.issue(42);
  const key = `auth:refresh:${createHash('sha256').update(token).digest('hex')}`;
  expect(token).toMatch(/^[A-Za-z0-9_-]{64}$/);
  expect(redis.eval).toHaveBeenCalledWith(
    expect.any(String),
    2,
    'auth:refresh:user:42',
    key,
    '{"userId":42}',
    256,
    3600,
  );
  expect(JSON.stringify(redis.eval.mock.calls)).not.toContain(token);
  await service.revoke(token);
  expect(redis.del).toHaveBeenCalledWith(key);
});

it('consumes the old token with one atomic Redis script before issuing a replacement', async () => {
  const { service, redis } = setup();
  redis.eval.mockResolvedValueOnce('{"userId":42}').mockResolvedValue(null);
  const rotated = await service.rotate('old-token');
  expect(rotated?.userId).toBe(42);
  expect(redis.eval.mock.calls[0][0]).toContain("redis.call('DEL', KEYS[1])");
  expect(await service.rotate('old-token')).toBeNull();
  expect(redis.eval.mock.calls.filter((call) => call[1] === 2)).toHaveLength(1);
});

it('does not coerce corrupt persisted identity values into a valid user', async () => {
  const { service, redis } = setup();
  for (const userId of [
    true,
    '42',
    [42],
    null,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    redis.eval.mockResolvedValueOnce(JSON.stringify({ userId }));
    expect(await service.rotate('token')).toBeNull();
  }
  expect(redis.eval.mock.calls.every((call) => call[1] === 1)).toBe(true);
  await expect(service.issue(0)).rejects.toThrow(RangeError);
});
