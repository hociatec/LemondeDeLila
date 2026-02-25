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
var UserInboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInboxService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_client_factory_1 = require("../../common/redis/redis-client.factory");
let UserInboxService = UserInboxService_1 = class UserInboxService {
    logger = new common_1.Logger(UserInboxService_1.name);
    redis;
    connected = false;
    constructor(config, redisFactory) {
        const redisUrl = config.get('NOTIFICATION_REDIS_URL') ||
            config.get('SESSION_STORE_REDIS_URL');
        if (!redisUrl) {
            throw new Error('NOTIFICATION_REDIS_URL ou SESSION_STORE_REDIS_URL doit être défini pour les notifications.');
        }
        this.redis = redisFactory.create(redisUrl, 'notify-inbox', {
            lazyConnect: true,
        });
    }
    async onModuleDestroy() {
        try {
            await this.redis.quit();
        }
        catch {
        }
    }
    async ensureConnected() {
        if (this.connected)
            return;
        try {
            await this.redis.connect();
        }
        catch {
        }
        this.connected = true;
    }
    hashKey(userId) {
        return `notify:inbox:${userId}:items`;
    }
    orderKey(userId) {
        return `notify:inbox:${userId}:order`;
    }
    async add(userId, item) {
        if (!userId || userId <= 0)
            return;
        if (!item?.id)
            return;
        await this.ensureConnected();
        const json = JSON.stringify(item);
        const score = Date.parse(item.createdAt || '') || Date.now();
        await this.redis
            .multi()
            .hset(this.hashKey(userId), item.id, json)
            .zadd(this.orderKey(userId), score, item.id)
            .exec();
        void this.trim(userId, 200);
    }
    async list(userId, limit = 100) {
        if (!userId || userId <= 0)
            return [];
        await this.ensureConnected();
        const ids = await this.redis.zrevrange(this.orderKey(userId), 0, limit - 1);
        if (!ids?.length)
            return [];
        const raw = await this.redis.hmget(this.hashKey(userId), ...ids);
        const out = [];
        for (const s of raw) {
            if (!s)
                continue;
            try {
                const parsed = JSON.parse(s);
                if (parsed?.id)
                    out.push(parsed);
            }
            catch {
            }
        }
        return out;
    }
    async delete(userId, id) {
        if (!userId || userId <= 0)
            return;
        if (!id || typeof id !== 'string')
            return;
        await this.ensureConnected();
        await this.redis
            .multi()
            .hdel(this.hashKey(userId), id)
            .zrem(this.orderKey(userId), id)
            .exec();
    }
    async trim(userId, max) {
        try {
            await this.ensureConnected();
            const count = await this.redis.zcard(this.orderKey(userId));
            const extra = count - max;
            if (extra <= 0)
                return;
            const idsToRemove = await this.redis.zrange(this.orderKey(userId), 0, extra - 1);
            if (!idsToRemove?.length)
                return;
            await this.redis
                .multi()
                .zremrangebyrank(this.orderKey(userId), 0, extra - 1)
                .hdel(this.hashKey(userId), ...idsToRemove)
                .exec();
        }
        catch (err) {
            this.logger.debug('Inbox trim failed', err);
        }
    }
};
exports.UserInboxService = UserInboxService;
exports.UserInboxService = UserInboxService = UserInboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService, redis_client_factory_1.RedisClientFactory])
], UserInboxService);
//# sourceMappingURL=user-inbox.service.js.map