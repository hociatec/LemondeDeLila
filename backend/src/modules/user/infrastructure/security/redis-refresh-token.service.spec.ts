import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import { RedisRefreshTokenService } from './redis-refresh-token.service';

function setup() {
  const redis = {
    eval: jest.fn(),
    get: jest.fn(),
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
    expect.stringMatching(/"nonce":"[a-f0-9]{64}"/),
    256,
    3600,
  );
  expect(JSON.stringify(redis.eval.mock.calls)).not.toContain(token);
  await service.revoke(token);
  expect(redis.del).toHaveBeenCalledWith(key);
});

it('returns the same successor on a retry without storing its bearer value', async () => {
  const { service, redis } = setup();
  const record = {
    userId: 42,
    nonce: 'a'.repeat(64),
    credentialVersion: 'b'.repeat(64),
  };
  redis.get.mockResolvedValue(JSON.stringify(record));
  redis.eval.mockResolvedValue(1);
  const rotated = await service.rotate('old-token');
  expect(rotated?.userId).toBe(42);
  redis.get.mockResolvedValue(JSON.stringify({ ...record, rotated: true }));
  expect(await service.rotate('old-token')).toEqual(rotated);
  expect(rotated?.credentialVersion).toBe(record.credentialVersion);
  expect(JSON.stringify(redis.eval.mock.calls)).not.toContain(
    rotated?.refreshToken,
  );
  expect(redis.eval.mock.calls.every((call) => call[1] === 3)).toBe(true);
  redis.eval.mockResolvedValue(0);
  expect(await service.rotate('old-token')).toBeNull();
});

it('retries an atomic compare failure and preserves the original record on a Redis failure', async () => {
  const { service, redis } = setup();
  redis.get.mockResolvedValue(
    JSON.stringify({ userId: 42, nonce: 'a'.repeat(64) }),
  );
  redis.eval.mockResolvedValueOnce(-1).mockResolvedValueOnce(1);
  expect((await service.rotate('old-token'))?.userId).toBe(42);
  expect(redis.get).toHaveBeenCalledTimes(2);
  redis.eval.mockRejectedValueOnce(new Error('unavailable'));
  await expect(service.rotate('old-token')).rejects.toThrow('unavailable');
  expect(redis.del).not.toHaveBeenCalled();
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
    redis.get.mockResolvedValueOnce(
      JSON.stringify({ userId, nonce: 'a'.repeat(64) }),
    );
    expect(await service.rotate('token')).toBeNull();
  }
  expect(redis.eval).not.toHaveBeenCalled();
  await expect(service.issue(0)).rejects.toThrow(RangeError);
});
