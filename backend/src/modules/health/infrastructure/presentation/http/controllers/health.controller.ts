import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { getBuildInfo } from '../../../../../../platform/observability/public-api';
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
      () => this.db.pingCheck('database'),
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
}
