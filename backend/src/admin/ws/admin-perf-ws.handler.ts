import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { AdminPerfSnapshotWsDto } from './admin-ws.dto';

@Injectable()
export class AdminPerfWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly perf: PerfMetricsService,
  ) {}

  async perfSnapshot(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminPerfSnapshotWsDto, payload ?? {});
    const snapshot = this.perf.snapshot({ windowSeconds: dto.windowSeconds });
    return { type: 'admin.perf.snapshot', payload: snapshot };
  }
}

