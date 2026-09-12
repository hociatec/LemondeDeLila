import { Inject, Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../../platform/realtime/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import {
  ADMIN_PERF_PORT,
  type AdminPerfPort,
} from '../../../application/ports/admin-perf.port';
import { AdminPerfSnapshotWsDto } from './dto/admin-ws.dto';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';

@Injectable()
export class AdminPerfWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    @Inject(ADMIN_PERF_PORT) private readonly perf: AdminPerfPort,
  ) {}

  perfSnapshot(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminPerfSnapshotWsDto, payload ?? {});
    const snapshot = this.perf.snapshot({ windowSeconds: dto.windowSeconds });
    return { type: WS_EVENTS.admin.perf.snapshot, payload: snapshot };
  }
}
