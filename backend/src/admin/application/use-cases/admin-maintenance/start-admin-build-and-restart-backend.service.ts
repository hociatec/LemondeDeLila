import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import {
  ADMIN_BACKEND_SERVICE,
  ADMIN_SERVICE_RE,
} from './admin-maintenance.constants';

@Injectable()
export class StartAdminBuildAndRestartBackendService {
  private readonly backendCwd = process.cwd();

  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute() {
    if (!ADMIN_SERVICE_RE.test(ADMIN_BACKEND_SERVICE)) {
      throw new InternalServerErrorException({
        message: `Service backend invalide: ${ADMIN_BACKEND_SERVICE}`,
      });
    }

    const chain = [
      `cd ${this.runtime.shQuote(this.backendCwd)}`,
      'npm run build',
      `sudo -n systemctl restart ${this.runtime.shQuote(ADMIN_BACKEND_SERVICE)}`,
    ].join(' && ');

    this.runtime.spawnDetached(['bash', '-lc', chain], { delayMs: 350 });
    return { ok: true, service: ADMIN_BACKEND_SERVICE, scheduled: true };
  }
}
