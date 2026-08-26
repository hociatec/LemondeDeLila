import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  AdminRoleGuard,
  HttpJwtGuard,
} from '../../../../../common/auth/public-api';
import { AdminMaintenanceGuard } from '../guards/admin-maintenance.guard';
import { AdminDaemonReloadService } from '../../../../application/use-cases/admin-maintenance/admin-daemon-reload.service';
import { AdminDryRunBuildService } from '../../../../application/use-cases/admin-maintenance/admin-dry-run-build.service';
import { AdminRunMigrationsService } from '../../../../application/use-cases/admin-maintenance/admin-run-migrations.service';
import { StartAdminBuildAndRestartBackendService } from '../../../../application/use-cases/admin-maintenance/start-admin-build-and-restart-backend.service';
import { StartAdminDeployService } from '../../../../application/use-cases/admin-maintenance/start-admin-deploy.service';
import { StartAdminRestartBackendService } from '../../../../application/use-cases/admin-maintenance/start-admin-restart-backend.service';

@Controller('api/admin/maintenance')
@UseGuards(HttpJwtGuard, AdminRoleGuard, AdminMaintenanceGuard)
export class AdminMaintenanceController {
  constructor(
    private readonly startDeployUseCase: StartAdminDeployService,
    private readonly dryRunBuildUseCase: AdminDryRunBuildService,
    private readonly runMigrationsUseCase: AdminRunMigrationsService,
    private readonly restartBackendUseCase: StartAdminRestartBackendService,
    private readonly buildAndRestartBackendUseCase: StartAdminBuildAndRestartBackendService,
    private readonly daemonReloadUseCase: AdminDaemonReloadService,
  ) {}

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
}
