import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
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
