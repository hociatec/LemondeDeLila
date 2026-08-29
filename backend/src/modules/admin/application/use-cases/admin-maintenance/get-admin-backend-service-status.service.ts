import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import {
  ADMIN_MAINTENANCE_CONFIG,
  type AdminMaintenanceConfig,
} from '../../ports/admin-maintenance-config.port';

@Injectable()
export class GetAdminBackendServiceStatusService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
    @Inject(ADMIN_MAINTENANCE_CONFIG)
    private readonly config: AdminMaintenanceConfig,
  ) {}

  execute() {
    const res = this.runtime.runCommand([
      'sudo',
      '-n',
      'systemctl',
      'show',
      this.config.backendService,
      '--no-pager',
      '--property=Id,ActiveState,SubState,Result,ExecMainStatus,ExecMainCode,ExecMainStartTimestamp,ExecMainExitTimestamp',
    ]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: `Impossible de lire le status systemd: ${this.config.backendService}`,
        details: res,
      });
    }
    const props = this.runtime.parseSystemctlShow(res.stdout);
    return { ok: true, unit: this.config.backendService, ...props };
  }
}
