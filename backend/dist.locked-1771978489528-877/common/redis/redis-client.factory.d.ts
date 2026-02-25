import Redis, { RedisOptions } from 'ioredis';
export declare class RedisClientFactory {
    private readonly logger;
    create(url: string, name: string, options?: RedisOptions): Redis;
}
