"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisNotificationTransport = exports.NotificationTransport = void 0;
const redis_pubsub_transport_1 = require("../../common/pubsub/redis-pubsub.transport");
class NotificationTransport {
}
exports.NotificationTransport = NotificationTransport;
class RedisNotificationTransport extends NotificationTransport {
    transport;
    constructor(url, redisFactory) {
        super();
        this.transport = new redis_pubsub_transport_1.RedisPubSubTransport(url, 'notifications', redisFactory
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
exports.RedisNotificationTransport = RedisNotificationTransport;
//# sourceMappingURL=notification-transport.js.map