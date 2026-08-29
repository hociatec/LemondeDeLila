import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { getBuildInfo } from '../../../../../common/utils/public-api';
import { RedisHealthIndicator } from '../../../checks/redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.ready();
  }

  @Get('live')
  live() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.check('redis'),
    ]);
  }

  @Get('info')
  info() {
    return {
      build: getBuildInfo(),
    };
  }
}
