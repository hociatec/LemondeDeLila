import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  AdminRoleGuard,
  HttpJwtGuard,
} from '../../../../../../platform/auth/public-api';
import { GetAdminBackendServiceStatusService } from '../../../../application/use-cases/admin-maintenance/get-admin-backend-service-status.service';
import { GetAdminDeployLogsService } from '../../../../application/use-cases/admin-maintenance/get-admin-deploy-logs.service';
import { GetAdminDeployStatusService } from '../../../../application/use-cases/admin-maintenance/get-admin-deploy-status.service';
import { GetAdminHealthService } from '../../../../application/use-cases/admin-maintenance/get-admin-health.service';
import { AdminMaintenanceGuard } from '../guards/admin-maintenance.guard';

@Controller('api/admin/maintenance')
@UseGuards(HttpJwtGuard, AdminRoleGuard, AdminMaintenanceGuard)
export class AdminMaintenanceStatusController {
  constructor(
    private readonly getHealth: GetAdminHealthService,
    private readonly getDeployStatus: GetAdminDeployStatusService,
    private readonly getDeployLogs: GetAdminDeployLogsService,
    private readonly getBackendStatus: GetAdminBackendServiceStatusService,
  ) {}

  @Get('health')
  health() {
    return this.getHealth.execute();
  }

  @Get('deploy/status')
  deployStatus() {
    return this.getDeployStatus.execute();
  }

  @Get('deploy/logs')
  deployLogs(@Query('tail') tail?: string) {
    const normalized =
      typeof tail === 'string' && /^\d{1,5}$/.test(tail.trim())
        ? Math.min(10_000, Number(tail))
        : undefined;
    return this.getDeployLogs.execute({
      tail: normalized === undefined ? undefined : String(normalized),
    });
  }

  @Get('service/status')
  serviceStatus() {
    return this.getBackendStatus.execute();
  }
}
