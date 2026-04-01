"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _config = require("@nestjs/config");
const _gameenginestatestore = require("../services/game-engine-state.store");
const redisData = new Map();
const mockCreateRedisClient = jest.fn().mockImplementation(()=>({
        get: jest.fn(async (key)=>redisData.get(key) ?? null),
        set: jest.fn(async (key, value)=>{
            redisData.set(key, value);
        }),
        del: jest.fn(async (key)=>{
            redisData.delete(key);
        }),
        on: jest.fn()
    }));
const mockRedisClientFactory = {
    create: mockCreateRedisClient
};
describe('GameEngineStateStore', ()=>{
    beforeEach(()=>{
        redisData.clear();
        mockCreateRedisClient.mockClear();
    });
    afterEach(()=>{
        delete process.env.GAME_ENGINE_STATE_REDIS_URL;
    });
    it('restores states from redis when memory cache is empty', async ()=>{
        process.env.GAME_ENGINE_STATE_REDIS_URL = 'redis://unit-test';
        const config = new _config.ConfigService();
        const storeA = new _gameenginestatestore.GameEngineStateStore(config, mockRedisClientFactory);
        const sampleState = {
            status: 'started',
            phase: 'playing',
            round: 1,
            turnIndex: 3,
            lastRoll: null,
            log: [],
            players: [
                {
                    id: 1,
                    username: 'A'
                }
            ],
            turn: {
                currentPlayerId: 1,
                direction: 1
            },
            metadata: {
                gameType: 'dame-nature',
                roomId: 7
            },
            botThinking: false
        };
        await storeA.set(7, 'dame-nature', sampleState);
        const storeB = new _gameenginestatestore.GameEngineStateStore(config, mockRedisClientFactory);
        const restored = await storeB.get(7, 'dame-nature');
        expect(restored).toBeDefined();
        expect(restored?.turnIndex).toBe(3);
    });
});
