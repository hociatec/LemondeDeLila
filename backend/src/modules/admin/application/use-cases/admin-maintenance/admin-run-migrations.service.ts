import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import { operationalSettings } from '../../../../../platform/config/public-api';
import {
  ADMIN_MAINTENANCE_CONFIG,
  type AdminMaintenanceConfig,
} from '../../ports/admin-maintenance-config.port';

@Injectable()
export class AdminRunMigrationsService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
    @Inject(ADMIN_MAINTENANCE_CONFIG)
    private readonly config: AdminMaintenanceConfig,
  ) {}

  execute() {
    const res = this.runtime.execute({
      kind: 'migrate',
      cwd: this.config.backendRoot,
      timeoutMs: operationalSettings.maintenanceCommandTimeoutMs,
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
