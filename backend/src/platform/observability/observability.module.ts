import { Module } from '@nestjs/common';
import {
  AdminRoleGuard,
  HttpJwtGuard,
  JwtPayloadVerifierService,
} from '../auth/public-api';
import { MetricsController } from './infrastructure/metrics/metrics.controller';

@Module({
  controllers: [MetricsController],
  providers: [JwtPayloadVerifierService, HttpJwtGuard, AdminRoleGuard],
})
export class ObservabilityModule {}
