"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisPresenceTransport = exports.PresenceTransport = void 0;
const redis_pubsub_transport_1 = require("../../common/pubsub/redis-pubsub.transport");
class PresenceTransport {
}
exports.PresenceTransport = PresenceTransport;
class RedisPresenceTransport extends PresenceTransport {
    transport;
    constructor(url, redisFactory) {
        super();
        this.transport = new redis_pubsub_transport_1.RedisPubSubTransport(url, 'presence-updates', redisFactory
            ? (u, name) => redisFactory.create(u, name, { lazyConnect: true })
            : undefined);
    }
    connect() {
        return this.transport.connect();
    }
    publish(event) {
        return this.transport.publish(event);
    }
    subscribe(handler) {
        return this.transport.subscribe(handler);
    }
    disconnect() {
        return this.transport.disconnect();
    }
}
exports.RedisPresenceTransport = RedisPresenceTransport;
//# sourceMappingURL=presence-transport.js.map