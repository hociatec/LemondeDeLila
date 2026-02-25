"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GameEngineStateStore_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngineStateStore = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_client_factory_1 = require("../../../common/redis/redis-client.factory");
let GameEngineStateStore = GameEngineStateStore_1 = class GameEngineStateStore {
    config;
    redisFactory;
    states = new Map();
    persistQueue = new Map();
    redis = null;
    logger = new common_1.Logger(GameEngineStateStore_1.name);
    redisPrefix = 'game:state:';
    constructor(config, redisFactory) {
        this.config = config;
        this.redisFactory = redisFactory;
        const redisUrl = this.config.get('GAME_ENGINE_STATE_REDIS_URL') ??
            this.config.get('SESSION_STORE_REDIS_URL') ??
            null;
        if (redisUrl && this.redisFactory) {
            this.initializeRedis(redisUrl);
        }
        else if (redisUrl && !this.redisFactory) {
            this.logger.warn('Redis configuré mais RedisClientFactory indisponible : fallback en mémoire.');
        }
        else {
            this.logger.warn('GAME_ENGINE_STATE_REDIS_URL non défini : fallback en mémoire (non persistant).');
        }
    }
    buildKey(roomId, gameType) {
        return `${gameType}:${roomId}`;
    }
    async get(roomId, gameType) {
        const key = this.buildKey(roomId, gameType);
        const cached = this.states.get(key);
        if (cached) {
            return cached;
        }
        if (!this.redis) {
            return undefined;
        }
        try {
            const raw = await this.redis.get(this.redisKey(key));
            if (!raw)
                return undefined;
            const parsed = JSON.parse(raw);
            this.states.set(key, parsed);
            return parsed;
        }
        catch (error) {
            this.logger.error('Impossible de restaurer un état depuis Redis', error, {
                key,
            });
            return undefined;
        }
    }
    async set(roomId, gameType, state, opts) {
        const key = this.buildKey(roomId, gameType);
        this.states.set(key, state);
        if (opts?.asyncPersist) {
            this.enqueuePersist(key, state);
            return;
        }
        await this.persistState(key, state);
    }
    async delete(roomId, gameType) {
        const key = this.buildKey(roomId, gameType);
        this.states.delete(key);
        if (this.redis) {
            try {
                await this.redis.del(this.redisKey(key));
            }
            catch (error) {
                this.logger.error('Impossible de supprimer un état Redis', error, {
                    key,
                });
            }
        }
    }
    markBotThinking(state, botThinking) {
        return { ...state, botThinking };
    }
    syncRoomStatus(state, payload) {
        const payloadStatus = payload?.room?.status;
        if (!payloadStatus || payloadStatus === state.status) {
            return state;
        }
        if ((state.status || '').toLowerCase() === 'started' &&
            payloadStatus !== 'finished') {
            return state;
        }
        return { ...state, status: payloadStatus };
    }
    initializeRedis(url) {
        if (!this.redisFactory) {
            this.redis = null;
            return;
        }
        try {
            this.redis = this.redisFactory.create(url, 'game-engine-state-store');
            this.logger.log('GameEngineStateStore connecté à Redis.');
        }
        catch (error) {
            this.logger.error("Impossible d'initialiser Redis pour GameEngineStateStore", error instanceof Error ? error.stack : String(error));
            this.redis = null;
        }
    }
    redisKey(key) {
        return `${this.redisPrefix}${key}`;
    }
    async persistState(key, state) {
        if (!this.redis)
            return;
        try {
            await this.redis.set(this.redisKey(key), JSON.stringify(state), 'EX', 60 * 60 * 24);
        }
        catch (error) {
            this.logger.error('Impossible de persister un état Redis', error, {
                key,
            });
        }
    }
    enqueuePersist(key, state) {
        const previous = this.persistQueue.get(key) ?? Promise.resolve();
        const next = previous
            .then(() => this.persistState(key, state))
            .catch(() => undefined);
        this.persistQueue.set(key, next);
        void next.finally(() => {
            if (this.persistQueue.get(key) === next) {
                this.persistQueue.delete(key);
            }
        });
    }
};
exports.GameEngineStateStore = GameEngineStateStore;
exports.GameEngineStateStore = GameEngineStateStore = GameEngineStateStore_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        redis_client_factory_1.RedisClientFactory])
], GameEngineStateStore);
//# sourceMappingURL=game-engine-state.store.js.map