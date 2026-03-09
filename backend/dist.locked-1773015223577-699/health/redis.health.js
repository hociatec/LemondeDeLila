"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RedisHealthIndicator", {
    enumerable: true,
    get: function() {
        return RedisHealthIndicator;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _terminus = require("@nestjs/terminus");
const _redisclientfactory = require("../common/redis/redis-client.factory");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let RedisHealthIndicator = class RedisHealthIndicator extends _terminus.HealthIndicator {
    async check(key) {
        const url = this.config.get('GAME_ENGINE_STATE_REDIS_URL') ?? this.config.get('SESSION_STORE_REDIS_URL');
        if (!url) {
            return this.getStatus(key, true, {
                message: 'Redis non configuré'
            });
        }
        let client = null;
        try {
            client = this.redisFactory.create(url, 'health:redis', {
                lazyConnect: true
            });
            await client.connect();
            await client.ping();
            await client.quit();
            return this.getStatus(key, true);
        } catch (error) {
            if (client) {
                try {
                    client.disconnect();
                } catch  {
                /* ignore */ }
            }
            throw new _terminus.HealthCheckError('Redis check failed', this.getStatus(key, false, {
                message: error instanceof Error ? error.message : String(error)
            }));
        }
    }
    constructor(config, redisFactory){
        super(), this.config = config, this.redisFactory = redisFactory;
    }
};
RedisHealthIndicator = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService,
        typeof _redisclientfactory.RedisClientFactory === "undefined" ? Object : _redisclientfactory.RedisClientFactory
    ])
], RedisHealthIndicator);
