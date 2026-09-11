import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import {
  AdminRoleGuard,
  HttpJwtGuard,
} from '../../../auth/public-api';
import { prometheusMetrics } from './prometheus-metrics';

@Controller('metrics')
@UseGuards(HttpJwtGuard, AdminRoleGuard)
export class MetricsController {
  @Get()
  @Header('Cache-Control', 'no-store')
  async getMetrics(): Promise<string> {
    return prometheusMetrics.registry.metrics();
  }
}
