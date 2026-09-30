import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import { prometheusMetrics } from '../../../../platform/observability/public-api';
import { redisReadinessTargets } from './redis-readiness-targets';
import { probeRedisReadiness } from './redis-readiness-probe';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly config: ConfigService,
    private readonly redisFactory: RedisClientFactory,
  ) {}

  async check(key: string): Promise<HealthIndicatorResult> {
    if (typeof key !== 'string' || !key.trim() || key.length > 128) {
      return this.status('redis', false);
    }
    const targets = redisReadinessTargets(this.config);
    const urls = [
      ...new Set(
        Object.values(targets).filter(
          (url): url is string =>
            typeof url === 'string' && url.length > 0 && url.length <= 2048,
        ),
      ),
    ];
    if (urls.length > 16) {
      return this.status(key, false, { capabilities: {} });
    }
    const probes = new Map(
      await Promise.all(
        urls.map(
          async (url) =>
            [url, await probeRedisReadiness(this.redisFactory, url)] as const,
        ),
      ),
    );
    const capabilities = Object.fromEntries(
      Object.entries(targets).map(([capability, url]) => [
        capability,
        url && probes.get(url) ? 'up' : 'down',
      ]),
    );
    const healthy = Object.values(capabilities).every(
      (status) => status === 'up',
    );
    prometheusMetrics.setDependencyUp('redis', healthy);
    return this.status(key, healthy, { capabilities });
  }

  private status(
    key: string,
    healthy: boolean,
    details: Record<string, unknown> = {},
  ): HealthIndicatorResult {
    return { [key]: { status: healthy ? 'up' : 'down', ...details } };
  }
}
