import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../../platform/realtime/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { AdminStatsService } from '../../../application/use-cases/admin-stats/admin-stats.service';

@Injectable()
export class AdminStatsWsHandler {
  constructor(private readonly stats: AdminStatsService) {}

  async statsResetAll(session: WsSession) {
    requireAdmin(session);
    return {
      type: WS_EVENTS.admin.stats.resetAll,
      payload: await this.stats.resetAll(),
    };
  }
}
