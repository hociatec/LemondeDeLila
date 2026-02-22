"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisSessionStore = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
class RedisSessionStore {
    logger = new common_1.Logger(RedisSessionStore.name);
    redis;
    prefix = 'ws:session:';
    constructor(redisUrl) {
        this.redis = new ioredis_1.default(redisUrl, { lazyConnect: true });
        this.redis.on('error', (err) => {
            this.logger.error('redis error', err instanceof Error ? err.stack : String(err));
        });
    }
    async save(connectionId, state) {
        await this.redis.set(this.prefix + connectionId, JSON.stringify(state), 'EX', 60 * 60 * 24);
    }
    async get(connectionId) {
        const raw = await this.redis.get(this.prefix + connectionId);
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async delete(connectionId) {
        await this.redis.del(this.prefix + connectionId);
    }
}
exports.RedisSessionStore = RedisSessionStore;
//# sourceMappingURL=redis-session-store.js.map