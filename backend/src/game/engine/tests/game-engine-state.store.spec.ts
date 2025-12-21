import { ConfigService } from '@nestjs/config';
import { GameEngineStateStore } from '../services/game-engine-state.store';
import { GameStateEntity } from '../../core/entities/game-state.entity';

const redisData = new Map<string, string>();

const mockRedisFactory = jest.fn().mockImplementation(() => ({
  get: jest.fn(async (key: string) => redisData.get(key) ?? null),
  set: jest.fn(async (key: string, value: string) => {
    redisData.set(key, value);
  }),
  del: jest.fn(async (key: string) => {
    redisData.delete(key);
  }),
  on: jest.fn(),
}));

jest.mock(
  'ioredis',
  () => {
    return function MockRedis(this: unknown, url: string) {
      return mockRedisFactory(url);
    };
  },
  { virtual: true },
);

describe('GameEngineStateStore', () => {
  beforeEach(() => {
    redisData.clear();
    mockRedisFactory.mockClear();
  });

  afterEach(() => {
    delete process.env.GAME_ENGINE_STATE_REDIS_URL;
  });

  it('restores states from redis when memory cache is empty', async () => {
    process.env.GAME_ENGINE_STATE_REDIS_URL = 'redis://unit-test';
    const config = new ConfigService();

    const storeA = new GameEngineStateStore(config);
    const sampleState: GameStateEntity = {
      status: 'started',
      phase: 'playing',
      round: 1,
      turnIndex: 3,
      lastRoll: null,
      log: [],
      players: [{ id: 1, username: 'A' }],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: { gameType: 'dame-nature', roomId: 7 },
      botThinking: false,
    };

    await storeA.set(7, 'dame-nature', sampleState);

    const storeB = new GameEngineStateStore(config);
    const restored = await storeB.get(7, 'dame-nature');

    expect(restored).toBeDefined();
    expect(restored?.turnIndex).toBe(3);
  });
});
