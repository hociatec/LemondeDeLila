import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import { ADMIN_BACKEND_SERVICE } from './admin-maintenance.constants';

@Injectable()
export class StartAdminRestartBackendService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute() {
    this.runtime.spawnDetached(
      ['sudo', '-n', 'systemctl', 'restart', ADMIN_BACKEND_SERVICE],
      { delayMs: 350 },
    );
    return { ok: true, service: ADMIN_BACKEND_SERVICE, scheduled: true };
  }
}
