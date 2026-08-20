import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';

@Injectable()
export class AdminDryRunBuildService {
  private readonly backendCwd = process.cwd();

  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute() {
    const res = this.runtime.runCommand(['npm', 'run', 'build'], {
      cwd: this.backendCwd,
      timeoutMs: 10 * 60 * 1000,
    });
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Build echoue (dry-run)',
        details: res,
      });
    }
    return { ok: true, command: 'npm run build', ...res };
  }
}
