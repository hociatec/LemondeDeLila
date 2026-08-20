import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import { ADMIN_BACKEND_SERVICE } from './admin-maintenance.constants';

@Injectable()
export class GetAdminBackendServiceStatusService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute() {
    const res = this.runtime.runCommand([
      'sudo',
      '-n',
      'systemctl',
      'show',
      ADMIN_BACKEND_SERVICE,
      '--no-pager',
      '--property=Id,ActiveState,SubState,Result,ExecMainStatus,ExecMainCode,ExecMainStartTimestamp,ExecMainExitTimestamp',
    ]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: `Impossible de lire le status systemd: ${ADMIN_BACKEND_SERVICE}`,
        details: res,
      });
    }
    const props = this.runtime.parseSystemctlShow(res.stdout);
    return { ok: true, unit: ADMIN_BACKEND_SERVICE, ...props };
  }
}
