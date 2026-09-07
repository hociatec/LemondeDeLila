const mockRedis = {
  on: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => mockRedis),
}));

import { RedisSessionStore } from './redis-session-store';

describe('RedisSessionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.quit.mockResolvedValue('OK');
  });

  it('persists, reads and deletes a validated session', async () => {
    const store = new RedisSessionStore('redis://localhost:6379/1');
    const state = { userId: 7, username: 'lila', roles: ['user'] };
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(state));

    await store.save('connection-1', state);
    await expect(store.get('connection-1')).resolves.toEqual(state);
    await store.delete('connection-1');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'ws:session:connection-1',
      JSON.stringify(state),
      'EX',
      86_400,
    );
    expect(mockRedis.del).toHaveBeenCalledWith('ws:session:connection-1');
  });

  it('rejects missing, malformed and structurally invalid stored values', async () => {
    const store = new RedisSessionStore('redis://localhost:6379/1');
    mockRedis.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('{')
      .mockResolvedValueOnce(JSON.stringify({ userId: '7' }))
      .mockResolvedValueOnce(JSON.stringify({ userId: 7, roles: [1] }))
      .mockResolvedValueOnce(JSON.stringify([]))
      .mockResolvedValueOnce(JSON.stringify({ userId: 1.5 }))
      .mockResolvedValueOnce(JSON.stringify({ userId: 7, username: 4 }));

    await expect(store.get('missing')).resolves.toBeNull();
    await expect(store.get('malformed')).resolves.toBeNull();
    await expect(store.get('bad-user')).resolves.toBeNull();
    await expect(store.get('bad-roles')).resolves.toBeNull();
    await expect(store.get('array')).resolves.toBeNull();
    await expect(store.get('unsafe-user')).resolves.toBeNull();
    await expect(store.get('bad-username')).resolves.toBeNull();
  });

  it('normalizes optional nullable session fields', async () => {
    const store = new RedisSessionStore('redis://localhost:6379/1');
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify({ userId: null }))
      .mockResolvedValueOnce(
        JSON.stringify({ userId: 7, username: null, roles: null }),
      );

    await expect(store.get('anonymous')).resolves.toEqual({
      userId: null,
      username: undefined,
      roles: undefined,
    });
    await expect(store.get('nullable')).resolves.toEqual({
      userId: 7,
      username: null,
      roles: null,
    });
  });

  it('closes the Redis connection during module shutdown', async () => {
    const store = new RedisSessionStore('redis://localhost:6379/1');
    await store.onModuleDestroy();
    expect(mockRedis.quit).toHaveBeenCalledTimes(1);
  });
});
