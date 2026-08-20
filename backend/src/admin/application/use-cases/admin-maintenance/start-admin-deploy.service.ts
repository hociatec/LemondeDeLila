import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import { ADMIN_DEPLOY_UNIT } from './admin-maintenance.constants';

@Injectable()
export class StartAdminDeployService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute() {
    const res = this.runtime.runCommand([
      'sudo',
      '-n',
      'systemctl',
      'start',
      '--no-block',
      ADMIN_DEPLOY_UNIT,
    ]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Echec du declenchement du deploiement',
        details: res,
      });
    }
    return { ok: true, unit: ADMIN_DEPLOY_UNIT };
  }
}
