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
import { databasePoolSaturation } from '../../../checks/database-pool-saturation';

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
    const saturation = databasePoolSaturation(this.dataSource.driver);
    if (saturation === null) return;
    prometheusMetrics.setDependencySaturation(
      'database',
      'connection-pool',
      saturation,
    );
  }
}
