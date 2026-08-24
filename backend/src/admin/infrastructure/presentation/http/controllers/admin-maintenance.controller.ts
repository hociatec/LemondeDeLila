import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminRoleGuard,
  HttpJwtGuard,
} from '../../../../../common/auth/public-api';
import { AdminMaintenanceGuard } from '../guards/admin-maintenance.guard';
import { AdminDaemonReloadService } from '../../../../application/use-cases/admin-maintenance/admin-daemon-reload.service';
import { AdminDryRunBuildService } from '../../../../application/use-cases/admin-maintenance/admin-dry-run-build.service';
import { AdminRunMigrationsService } from '../../../../application/use-cases/admin-maintenance/admin-run-migrations.service';
import { GetAdminBackendServiceStatusService } from '../../../../application/use-cases/admin-maintenance/get-admin-backend-service-status.service';
import { GetAdminDeployLogsService } from '../../../../application/use-cases/admin-maintenance/get-admin-deploy-logs.service';
import { GetAdminDeployStatusService } from '../../../../application/use-cases/admin-maintenance/get-admin-deploy-status.service';
import { GetAdminHealthService } from '../../../../application/use-cases/admin-maintenance/get-admin-health.service';
import { StartAdminBuildAndRestartBackendService } from '../../../../application/use-cases/admin-maintenance/start-admin-build-and-restart-backend.service';
import { StartAdminDeployService } from '../../../../application/use-cases/admin-maintenance/start-admin-deploy.service';
import { StartAdminRestartBackendService } from '../../../../application/use-cases/admin-maintenance/start-admin-restart-backend.service';

@Controller('api/admin/maintenance')
@UseGuards(HttpJwtGuard, AdminRoleGuard, AdminMaintenanceGuard)
export class AdminMaintenanceController {
  constructor(
    private readonly getHealthUseCase: GetAdminHealthService,
    private readonly startDeployUseCase: StartAdminDeployService,
    private readonly dryRunBuildUseCase: AdminDryRunBuildService,
    private readonly runMigrationsUseCase: AdminRunMigrationsService,
    private readonly restartBackendUseCase: StartAdminRestartBackendService,
    private readonly buildAndRestartBackendUseCase: StartAdminBuildAndRestartBackendService,
    private readonly daemonReloadUseCase: AdminDaemonReloadService,
    private readonly getDeployStatusUseCase: GetAdminDeployStatusService,
    private readonly getDeployLogsUseCase: GetAdminDeployLogsService,
    private readonly getBackendStatusUseCase: GetAdminBackendServiceStatusService,
  ) {}

  @Get('health')
  health() {
    return this.getHealthUseCase.execute();
  }

  @Post('deploy')
  @HttpCode(202)
  deploy() {
    return this.startDeployUseCase.execute();
  }

  @Post('deploy/dry-run')
  dryRunBuild() {
    return this.dryRunBuildUseCase.execute();
  }

  @Post('migrations/run')
  migrationsRun() {
    return this.runMigrationsUseCase.execute();
  }

  @Post('service/restart')
  @HttpCode(202)
  restartService() {
    return this.restartBackendUseCase.execute();
  }

  @Post('service/build-restart')
  @HttpCode(202)
  buildAndRestartService() {
    return this.buildAndRestartBackendUseCase.execute();
  }

  @Post('systemd/daemon-reload')
  systemdDaemonReload() {
    return this.daemonReloadUseCase.execute();
  }

  @Get('deploy/status')
  deployStatus() {
    return this.getDeployStatusUseCase.execute();
  }

  @Get('deploy/logs')
  deployLogs(@Query('tail') tail?: string) {
    return this.getDeployLogsUseCase.execute({ tail });
  }

  @Get('service/status')
  serviceStatus() {
    return this.getBackendStatusUseCase.execute();
  }
}


