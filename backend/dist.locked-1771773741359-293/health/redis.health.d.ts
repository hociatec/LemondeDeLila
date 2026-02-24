import { ConfigService } from '@nestjs/config';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { RedisClientFactory } from '../common/redis/redis-client.factory';
export declare class RedisHealthIndicator extends HealthIndicator {
    private readonly config;
    private readonly redisFactory;
    constructor(config: ConfigService, redisFactory: RedisClientFactory);
    check(key: string): Promise<HealthIndicatorResult>;
}
