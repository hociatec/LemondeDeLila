import { Module } from '@nestjs/common';
import { MetricsController } from './infrastructure/metrics/metrics.controller';

@Module({ controllers: [MetricsController] })
export class ObservabilityModule {}
