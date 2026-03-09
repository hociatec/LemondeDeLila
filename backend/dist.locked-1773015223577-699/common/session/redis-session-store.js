"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RedisSessionStore", {
    enumerable: true,
    get: function() {
        return RedisSessionStore;
    }
});
const _common = require("@nestjs/common");
const _ioredis = /*#__PURE__*/ _interop_require_default(require("ioredis"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
let RedisSessionStore = class RedisSessionStore {
    async save(connectionId, state) {
        await this.redis.set(this.prefix + connectionId, JSON.stringify(state), 'EX', 60 * 60 * 24);
    }
    async get(connectionId) {
        const raw = await this.redis.get(this.prefix + connectionId);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch  {
            return null;
        }
    }
    async delete(connectionId) {
        await this.redis.del(this.prefix + connectionId);
    }
    constructor(redisUrl){
        this.logger = new _common.Logger(RedisSessionStore.name);
        this.prefix = 'ws:session:';
        this.redis = new _ioredis.default(redisUrl, {
            lazyConnect: true
        });
        this.redis.on('error', (err)=>{
            this.logger.error('redis error', err instanceof Error ? err.stack : String(err));
        });
    }
};
