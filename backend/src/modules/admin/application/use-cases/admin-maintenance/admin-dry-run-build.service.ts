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
export class AdminDryRunBuildService {
  private readonly backendCwd = process.cwd();

  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute() {
    const res = this.runtime.runCommand(['npm', 'run', 'build'], {
      cwd: this.backendCwd,
      timeoutMs: operationalPolicy.maintenanceCommandTimeoutMs,
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
