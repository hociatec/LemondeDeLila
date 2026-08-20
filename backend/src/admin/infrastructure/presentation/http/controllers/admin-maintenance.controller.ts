import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../../../../common/guards/admin-role.guard';
import { AdminMaintenanceGuard } from '../guards/admin-maintenance.guard';
import { AdminMaintenanceService } from '../../../../../application/services/admin-maintenance.service';

@Controller('api/admin/maintenance')
@UseGuards(HttpJwtGuard, AdminRoleGuard, AdminMaintenanceGuard)
export class AdminMaintenanceController {
  constructor(private readonly maintenance: AdminMaintenanceService) {}

  @Get('health')
  health() {
    return this.maintenance.getHealth();
  }

  @Post('deploy')
  @HttpCode(202)
  deploy() {
    return this.maintenance.startDeploy();
  }

  @Post('deploy/dry-run')
  dryRunBuild() {
    return this.maintenance.dryRunBuild();
  }

  @Post('migrations/run')
  migrationsRun() {
    return this.maintenance.runMigrations();
  }

  @Post('service/restart')
  @HttpCode(202)
  restartService() {
    return this.maintenance.startRestartBackend();
  }

  @Post('service/build-restart')
  @HttpCode(202)
  buildAndRestartService() {
    return this.maintenance.startBuildAndRestartBackend();
  }

  @Post('systemd/daemon-reload')
  systemdDaemonReload() {
    return this.maintenance.daemonReload();
  }

  @Get('deploy/status')
  deployStatus() {
    return this.maintenance.getDeployStatus();
  }

  @Get('deploy/logs')
  deployLogs(@Query('tail') tail?: string) {
    return this.maintenance.getDeployLogs({ tail });
  }

  @Get('service/status')
  serviceStatus() {
    return this.maintenance.getBackendServiceStatus();
  }
}


