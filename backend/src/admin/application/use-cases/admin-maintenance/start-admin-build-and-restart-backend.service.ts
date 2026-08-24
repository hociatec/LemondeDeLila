import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import {
  ADMIN_MAINTENANCE_CONFIG,
  ADMIN_SERVICE_RE,
  type AdminMaintenanceConfig,
} from '../../ports/admin-maintenance-config.port';

@Injectable()
export class StartAdminBuildAndRestartBackendService {
  private readonly backendCwd = process.cwd();

  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
    @Inject(ADMIN_MAINTENANCE_CONFIG)
    private readonly config: AdminMaintenanceConfig,
  ) {}

  execute() {
    if (!ADMIN_SERVICE_RE.test(this.config.backendService)) {
      throw new InternalServerErrorException({
        message: `Service backend invalide: ${this.config.backendService}`,
      });
    }

    const chain = [
      `cd ${this.runtime.shQuote(this.backendCwd)}`,
      'npm run build',
      `sudo -n systemctl restart ${this.runtime.shQuote(this.config.backendService)}`,
    ].join(' && ');

    this.runtime.spawnDetached(['bash', '-lc', chain], { delayMs: 350 });
    return { ok: true, service: this.config.backendService, scheduled: true };
  }
}
