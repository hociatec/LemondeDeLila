import { RoomPayloadCacheService } from './room-payload-cache.service';

describe('RoomPayloadCacheService degradation', () => {
  it('fails open and permanently disables a failing optional Redis cache', async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('redis down')),
      on: jest.fn(),
      disconnect: jest.fn(),
    };
    const factory = { create: jest.fn(() => redis) };
    const config = {
      get: jest.fn((key: string) =>
        key === 'ROOM_PAYLOAD_REDIS_URL' ? 'redis://test' : undefined,
      ),
    };
    const cache = new RoomPayloadCacheService(config as any, factory as any);
    await expect(cache.get(1)).resolves.toBeNull();
    await expect(cache.get(1)).resolves.toBeNull();
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.disconnect).toHaveBeenCalledTimes(1);
  });

  it('closes an initialized cache client on module shutdown', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      on: jest.fn(),
      disconnect: jest.fn(),
    };
    const cache = new RoomPayloadCacheService(
      { get: jest.fn(() => 'redis://test') } as any,
      { create: jest.fn(() => redis) } as any,
    );
    await cache.get(1);
    cache.onModuleDestroy();
    expect(redis.disconnect).toHaveBeenCalledTimes(1);
  });
});
