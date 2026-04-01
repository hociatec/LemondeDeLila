"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameEngineStateStore", {
    enumerable: true,
    get: function() {
        return GameEngineStateStore;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _redisclientfactory = require("../../../common/redis/redis-client.factory");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameEngineStateStore = class GameEngineStateStore {
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
            if (!raw) return undefined;
            const parsed = JSON.parse(raw);
            this.states.set(key, parsed);
            return parsed;
        } catch (error) {
            this.disableRedis('lecture impossible depuis Redis (fallback mémoire)', error);
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
            } catch (error) {
                this.disableRedis('suppression impossible dans Redis (fallback mémoire)', error);
            }
        }
    }
    markBotThinking(state, botThinking) {
        return {
            ...state,
            botThinking
        };
    }
    syncRoomStatus(state, payload) {
        const payloadStatus = payload?.room?.status;
        if (!payloadStatus || payloadStatus === state.status) {
            return state;
        }
        if ((state.status || '').toLowerCase() === 'started' && payloadStatus !== 'finished') {
            return state;
        }
        return {
            ...state,
            status: payloadStatus
        };
    }
    initializeRedis(url) {
        if (!this.redisFactory) {
            this.redis = null;
            return;
        }
        if (this.redisDisabled) {
            return;
        }
        try {
            this.redis = this.redisFactory.create(url, 'game-engine-state-store');
            this.redis.on('error', (error)=>{
                if (!this.isFatalRedisError(error)) {
                    return;
                }
                this.disableRedis('erreur Redis fatale (fallback mémoire)', error);
            });
            this.logger.log('GameEngineStateStore connecté à Redis.');
        } catch (error) {
            this.disableRedis('initialisation Redis impossible (fallback mémoire)', error);
        }
    }
    redisKey(key) {
        return `${this.redisPrefix}${key}`;
    }
    async persistState(key, state) {
        if (!this.redis) return;
        try {
            await this.redis.set(this.redisKey(key), JSON.stringify(state), 'EX', 60 * 60 * 24);
        } catch (error) {
            this.disableRedis('écriture impossible dans Redis (fallback mémoire)', error);
        }
    }
    disableRedis(reason, error) {
        const details = this.extractErrorMessage(error);
        if (!this.redisDisabled) {
            this.logger.warn(details ? `${reason}: ${details}` : reason);
        }
        this.redisDisabled = true;
        if (!this.redis) {
            return;
        }
        try {
            this.redis.disconnect();
        } catch  {
        // best effort
        }
        this.redis = null;
    }
    isFatalRedisError(error) {
        const message = this.extractErrorMessage(error) ?? '';
        const normalized = message.toLowerCase();
        return normalized.includes('noauth') || normalized.includes('wrongpass') || normalized.includes('authentication') || normalized.includes('connection is closed');
    }
    extractErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return typeof error === 'string' ? error : null;
    }
    enqueuePersist(key, state) {
        const previous = this.persistQueue.get(key) ?? Promise.resolve();
        const next = previous.then(()=>this.persistState(key, state)).catch(()=>undefined);
        this.persistQueue.set(key, next);
        void next.finally(()=>{
            if (this.persistQueue.get(key) === next) {
                this.persistQueue.delete(key);
            }
        });
    }
    constructor(config, redisFactory){
        this.config = config;
        this.redisFactory = redisFactory;
        this.states = new Map();
        this.persistQueue = new Map();
        this.redis = null;
        this.redisDisabled = false;
        this.logger = new _common.Logger(GameEngineStateStore.name);
        this.redisPrefix = 'game:state:';
        const redisUrl = this.config.get('GAME_ENGINE_STATE_REDIS_URL') ?? this.config.get('SESSION_STORE_REDIS_URL') ?? null;
        if (redisUrl && this.redisFactory) {
            this.initializeRedis(redisUrl);
        } else if (redisUrl && !this.redisFactory) {
            this.logger.warn('Redis configuré mais RedisClientFactory indisponible : fallback en mémoire.');
        } else {
            this.logger.warn('GAME_ENGINE_STATE_REDIS_URL non défini : fallback en mémoire (non persistant).');
        }
    }
};
GameEngineStateStore = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService,
        typeof _redisclientfactory.RedisClientFactory === "undefined" ? Object : _redisclientfactory.RedisClientFactory
    ])
], GameEngineStateStore);
