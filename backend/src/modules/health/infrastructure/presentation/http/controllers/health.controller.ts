import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import {
  getBuildInfo,
  prometheusMetrics,
} from '../../../../../../platform/observability/public-api';
import { RedisHealthIndicator } from '../../../checks/redis.health';
import { BullmqHealthIndicator } from '../../../checks/bullmq.health';
import { RuntimeHealthIndicator } from '../../../checks/runtime.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly bullmq: BullmqHealthIndicator,
    private readonly runtime: RuntimeHealthIndicator,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.ready();
  }

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([() => this.runtime.checkEventLoop('eventLoop')]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.redis.check('redis'),
      () => this.bullmq.check('bullmq'),
      () => this.runtime.checkStorage('storage'),
    ]);
  }

  @Get('info')
  info() {
    return {
      build: getBuildInfo(),
    };
  }

  private async checkDatabase() {
    try {
      const result = await this.db.pingCheck('database');
      prometheusMetrics.setDependencyUp('database', true);
      this.recordDatabasePoolSaturation();
      return result;
    } catch (error) {
      prometheusMetrics.setDependencyUp('database', false);
      throw error;
    }
  }

  private recordDatabasePoolSaturation(): void {
    const driver = this.dataSource.driver as unknown as {
      pool?: {
        _allConnections?: { length: number };
        _freeConnections?: { length: number };
        config?: { connectionLimit?: number };
      };
    };
    const pool = driver.pool;
    const total = pool?._allConnections?.length ?? 0;
    const free = pool?._freeConnections?.length ?? 0;
    const limit = pool?.config?.connectionLimit ?? total;
    prometheusMetrics.setDependencySaturation(
      'database',
      'connection-pool',
      limit > 0 ? (total - free) / limit : 0,
    );
  }
}
