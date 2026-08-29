import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import { operationalPolicy } from '../../../../../platform/config/public-api';

@Injectable()
export class AdminRunMigrationsService {
  private readonly backendCwd = process.cwd();

  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute() {
    const res = this.runtime.runCommand(['npm', 'run', 'migration:run'], {
      cwd: this.backendCwd,
      timeoutMs: operationalPolicy.maintenanceCommandTimeoutMs,
    });
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Migrations echouees',
        details: res,
      });
    }
    return { ok: true, command: 'npm run migration:run', ...res };
  }
}
