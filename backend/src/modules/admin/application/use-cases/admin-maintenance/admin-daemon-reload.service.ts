import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';

@Injectable()
export class AdminDaemonReloadService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  execute() {
    const res = this.runtime.runCommand([
      'sudo',
      '-n',
      'systemctl',
      'daemon-reload',
    ]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Echec systemd daemon-reload',
        details: res,
      });
    }
    return { ok: true, command: 'systemctl daemon-reload', ...res };
  }
}
