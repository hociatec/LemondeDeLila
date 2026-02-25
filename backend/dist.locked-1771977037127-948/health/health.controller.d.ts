import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
export declare class HealthController {
    private readonly health;
    private readonly db;
    private readonly redis;
    constructor(health: HealthCheckService, db: TypeOrmHealthIndicator, redis: RedisHealthIndicator);
    check(): Promise<import("@nestjs/terminus").HealthCheckResult>;
}
