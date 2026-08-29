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
export class GetAdminDeployLogsService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
    @Inject(ADMIN_MAINTENANCE_CONFIG)
    private readonly config: AdminMaintenanceConfig,
  ) {}

  execute(input: { tail?: string }) {
    const tail = this.runtime.parseTail(input.tail);
    const res = this.runtime.runCommand([
      'sudo',
      '-n',
      'journalctl',
      '-u',
      this.config.deployUnit,
      '--no-pager',
      '-o',
      'short-iso',
      '-n',
      String(tail),
    ]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Impossible de lire les logs du deploiement',
        details: res,
      });
    }
    return { ok: true, unit: this.config.deployUnit, tail, logs: res.stdout };
  }
}
