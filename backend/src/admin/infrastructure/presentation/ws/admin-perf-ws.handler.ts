import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { AdminPerfService } from '../../../application/use-cases/admin-perf/admin-perf.service';
import { AdminPerfSnapshotWsDto } from './dto/admin-ws.dto';
import { WS_EVENTS } from '../../../../realtime/public-api';

@Injectable()
export class AdminPerfWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly perf: AdminPerfService,
  ) {}

  perfSnapshot(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminPerfSnapshotWsDto, payload ?? {});
    const snapshot = this.perf.snapshot({ windowSeconds: dto.windowSeconds });
    return { type: WS_EVENTS.admin.perf.snapshot, payload: snapshot };
  }
}
