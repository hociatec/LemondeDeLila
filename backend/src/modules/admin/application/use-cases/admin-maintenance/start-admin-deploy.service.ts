import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import {
  ADMIN_MAINTENANCE_CONFIG,
  type AdminMaintenanceConfig,
} from '../../ports/admin-maintenance-config.port';

@Injectable()
export class StartAdminDeployService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
    @Inject(ADMIN_MAINTENANCE_CONFIG)
    private readonly config: AdminMaintenanceConfig,
  ) {}

  execute() {
    this.runtime.spawnDetached([
      'sudo',
      '-n',
      'systemctl',
      'start',
      this.config.deployUnit,
    ]);
    return { ok: true, unit: this.config.deployUnit };
  }
}
