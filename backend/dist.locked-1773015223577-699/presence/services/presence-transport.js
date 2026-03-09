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
    get PresenceTransport () {
        return PresenceTransport;
    },
    get RedisPresenceTransport () {
        return RedisPresenceTransport;
    }
});
const _redispubsubtransport = require("../../common/pubsub/redis-pubsub.transport");
let PresenceTransport = class PresenceTransport {
};
let RedisPresenceTransport = class RedisPresenceTransport extends PresenceTransport {
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
        this.transport = new _redispubsubtransport.RedisPubSubTransport(url, 'presence-updates', redisFactory ? (u, name)=>redisFactory.create(u, name, {
                lazyConnect: true
            }) : undefined);
    }
};
