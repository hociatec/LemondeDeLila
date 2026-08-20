import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_MAINTENANCE_RUNTIME_PORT,
  type AdminMaintenanceRuntimePort,
} from '../../ports/admin-maintenance-runtime.port';

@Injectable()
export class GetAdminHealthService {
  constructor(
    @Inject(ADMIN_MAINTENANCE_RUNTIME_PORT)
    private readonly runtime: AdminMaintenanceRuntimePort,
  ) {}

  async execute(): Promise<{
    ok: true;
    url: string;
    statusCode: number;
    body: string;
  }> {
    const port = Number(process.env.PORT || 3000);
    const url = `http://127.0.0.1:${port}/health`;
    const res = await this.runtime.httpGet(url, 3500);
    return { ok: true, url, statusCode: res.statusCode, body: res.body };
  }
}
