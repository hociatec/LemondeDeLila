import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { RedisClientFactory } from '../../../../platform/redis/public-api';
import { prometheusMetrics } from '../../../../platform/observability/public-api';
import { redisReadinessTargets } from './redis-readiness-targets';
import { probeRedisReadiness } from './redis-readiness-probe';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    private readonly config: ConfigService,
    private readonly redisFactory: RedisClientFactory,
  ) {
    super();
  }

  async check(key: string): Promise<HealthIndicatorResult> {
    if (typeof key !== 'string' || !key.trim() || key.length > 128) {
      throw new HealthCheckError(
        'Invalid health-check key',
        this.getStatus('redis', false),
      );
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
      throw new HealthCheckError(
        'Too many Redis readiness targets',
        this.getStatus(key, false, { capabilities: {} }),
      );
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
    const result = this.getStatus(key, healthy, { capabilities });
    if (!healthy)
      throw new HealthCheckError(
        'Required Redis capability unavailable',
        result,
      );
    return result;
  }
}
