import { Controller, Get, Header } from '@nestjs/common';
import { prometheusMetrics } from './prometheus-metrics';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Cache-Control', 'no-store')
  async getMetrics(): Promise<string> {
    return prometheusMetrics.registry.metrics();
  }
}
