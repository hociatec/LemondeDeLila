import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_PERF_PORT,
  type AdminPerfPort,
} from '../../ports/admin-perf.port';

@Injectable()
export class AdminPerfService {
  constructor(@Inject(ADMIN_PERF_PORT) private readonly perf: AdminPerfPort) {}

  snapshot(input: { windowSeconds?: number }) {
    return this.perf.snapshot({ windowSeconds: input.windowSeconds });
  }
}
