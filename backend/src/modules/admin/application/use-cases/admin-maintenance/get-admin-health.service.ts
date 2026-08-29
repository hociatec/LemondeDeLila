import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';
import {
  ADMIN_MAINTENANCE_CONFIG,
  type AdminMaintenanceConfig,
} from '../../ports/admin-maintenance-config.port';

@Injectable()
export class GetAdminHealthService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
    @Inject(ADMIN_MAINTENANCE_CONFIG)
    private readonly config: AdminMaintenanceConfig,
  ) {}

  async execute(): Promise<{
    ok: true;
    url: string;
    statusCode: number;
    body: string;
  }> {
    const url = `http://127.0.0.1:${this.config.healthPort}/health`;
    const res = await this.runtime.httpGet(url, 3500);
    return { ok: true, url, statusCode: res.statusCode, body: res.body };
  }
}
