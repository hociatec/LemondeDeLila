"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RedisPubSubTransport", {
    enumerable: true,
    get: function() {
        return RedisPubSubTransport;
    }
});
const _common = require("@nestjs/common");
const _ioredis = /*#__PURE__*/ _interop_require_default(require("ioredis"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
let RedisPubSubTransport = class RedisPubSubTransport {
    async connect() {
        try {
            await Promise.all([
                this.publisher.connect(),
                this.subscriber.connect()
            ]);
        } catch (error) {
            this.logger.warn(`Impossible de se connecter à Redis pubsub (${this.channel})`, error instanceof Error ? error.stack : String(error));
        }
    }
    async publish(event) {
        await this.publisher.publish(this.channel, JSON.stringify(event));
    }
    async subscribe(handler) {
        this.subscriber.on('message', (channel, message)=>{
            if (channel !== this.channel) return;
            try {
                const parsed = JSON.parse(message);
                handler(parsed);
            } catch  {
            /* ignore malformed payloads */ }
        });
        await this.subscriber.subscribe(this.channel);
    }
    disconnect() {
        this.publisher.disconnect();
        this.subscriber.disconnect();
        return Promise.resolve();
    }
    constructor(url, channel, createClient = (url, name)=>{
        const client = new _ioredis.default(url, {
            lazyConnect: true,
            connectionName: name
        });
        // Important: ioredis emits an 'error' event which will crash the process if unhandled.
        // Default transport is best-effort; dedicated factories can log details.
        client.on('error', ()=>{});
        return client;
    }){
        this.url = url;
        this.channel = channel;
        this.createClient = createClient;
        this.logger = new _common.Logger(RedisPubSubTransport.name);
        this.publisher = this.createClient(this.url, `pubsub:${this.channel}:pub`);
        this.subscriber = this.createClient(this.url, `pubsub:${this.channel}:sub`);
    }
};
