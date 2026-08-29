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
export class StartAdminDeployService {
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
      'start',
      '--no-block',
      this.config.deployUnit,
    ]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Echec du declenchement du deploiement',
        details: res,
      });
    }
    return { ok: true, unit: this.config.deployUnit };
  }
}
