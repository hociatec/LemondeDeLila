import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import { ADMIN_DEPLOY_UNIT } from './admin-maintenance.constants';

@Injectable()
export class GetAdminDeployLogsService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute(input: { tail?: string }) {
    const tail = this.runtime.parseTail(input.tail);
    const res = this.runtime.runCommand([
      'sudo',
      '-n',
      'journalctl',
      '-u',
      ADMIN_DEPLOY_UNIT,
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
    return { ok: true, unit: ADMIN_DEPLOY_UNIT, tail, logs: res.stdout };
  }
}
