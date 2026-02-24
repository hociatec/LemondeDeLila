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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisHealthIndicator = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const terminus_1 = require("@nestjs/terminus");
const redis_client_factory_1 = require("../common/redis/redis-client.factory");
let RedisHealthIndicator = class RedisHealthIndicator extends terminus_1.HealthIndicator {
    config;
    redisFactory;
    constructor(config, redisFactory) {
        super();
        this.config = config;
        this.redisFactory = redisFactory;
    }
    async check(key) {
        const url = this.config.get('GAME_ENGINE_STATE_REDIS_URL') ??
            this.config.get('SESSION_STORE_REDIS_URL');
        if (!url) {
            return this.getStatus(key, true, {
                message: 'Redis non configuré',
            });
        }
        let client = null;
        try {
            client = this.redisFactory.create(url, 'health:redis', {
                lazyConnect: true,
            });
            await client.connect();
            await client.ping();
            await client.quit();
            return this.getStatus(key, true);
        }
        catch (error) {
            if (client) {
                try {
                    client.disconnect();
                }
                catch {
                }
            }
            throw new terminus_1.HealthCheckError('Redis check failed', this.getStatus(key, false, {
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    }
};
exports.RedisHealthIndicator = RedisHealthIndicator;
exports.RedisHealthIndicator = RedisHealthIndicator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        redis_client_factory_1.RedisClientFactory])
], RedisHealthIndicator);
//# sourceMappingURL=redis.health.js.map