import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HttpJwtGuard } from '../../common/guards/http-jwt.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { AdminMaintenanceGuard } from '../guards/admin-maintenance.guard';
import { AdminMaintenanceService } from '../services/admin-maintenance.service';

@Controller('api/admin/maintenance')
@UseGuards(HttpJwtGuard, AdminRoleGuard, AdminMaintenanceGuard)
export class AdminMaintenanceController {
  constructor(private readonly maintenance: AdminMaintenanceService) {}

  @Post('deploy')
  @HttpCode(202)
  deploy() {
    return this.maintenance.startDeploy();
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

