"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get NotificationTransport () {
        return NotificationTransport;
    },
    get RedisNotificationTransport () {
        return RedisNotificationTransport;
    }
});
const _redispubsubtransport = require("../../common/pubsub/redis-pubsub.transport");
let NotificationTransport = class NotificationTransport {
};
let RedisNotificationTransport = class RedisNotificationTransport extends NotificationTransport {
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
    constructor(url, redisFactory){
        super();
        this.transport = new _redispubsubtransport.RedisPubSubTransport(url, 'notifications', redisFactory ? (u, name)=>redisFactory.create(u, name, {
                lazyConnect: true,
                // Pub/sub notifications should never block API requests when Redis is down.
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
                connectionName: name
            }) : undefined);
    }
};
