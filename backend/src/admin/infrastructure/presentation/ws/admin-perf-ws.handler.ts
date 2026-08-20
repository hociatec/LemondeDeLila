import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { AdminPerfService } from '../../../application/use-cases/admin-perf/admin-perf.service';
import { AdminPerfSnapshotWsDto } from './admin-ws.dto';
import { WS_EVENTS } from '../../../../common/ws/ws-events';

@Injectable()
export class AdminPerfWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly perf: AdminPerfService,
  ) {}

  perfSnapshot(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminPerfSnapshotWsDto, payload ?? {});
    const snapshot = this.perf.snapshot({ windowSeconds: dto.windowSeconds });
    return { type: WS_EVENTS.admin.perf.snapshot, payload: snapshot };
  }
}





