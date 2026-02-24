"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisPubSubTransport = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
class RedisPubSubTransport {
    url;
    channel;
    createClient;
    publisher;
    subscriber;
    logger = new common_1.Logger(RedisPubSubTransport.name);
    constructor(url, channel, createClient = (url, name) => {
        const client = new ioredis_1.default(url, {
            lazyConnect: true,
            connectionName: name,
        });
        client.on('error', () => { });
        return client;
    }) {
        this.url = url;
        this.channel = channel;
        this.createClient = createClient;
        this.publisher = this.createClient(this.url, `pubsub:${this.channel}:pub`);
        this.subscriber = this.createClient(this.url, `pubsub:${this.channel}:sub`);
    }
    async connect() {
        try {
            await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
        }
        catch (error) {
            this.logger.warn(`Impossible de se connecter à Redis pubsub (${this.channel})`, error instanceof Error ? error.stack : String(error));
        }
    }
    async publish(event) {
        await this.publisher.publish(this.channel, JSON.stringify(event));
    }
    async subscribe(handler) {
        this.subscriber.on('message', (channel, message) => {
            if (channel !== this.channel)
                return;
            try {
                const parsed = JSON.parse(message);
                handler(parsed);
            }
            catch {
            }
        });
        await this.subscriber.subscribe(this.channel);
    }
    disconnect() {
        this.publisher.disconnect();
        this.subscriber.disconnect();
        return Promise.resolve();
    }
}
exports.RedisPubSubTransport = RedisPubSubTransport;
//# sourceMappingURL=redis-pubsub.transport.js.map