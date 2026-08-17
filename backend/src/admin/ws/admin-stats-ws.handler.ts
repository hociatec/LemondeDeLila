import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { GameStatsService } from '../../stats/services/game-stats.service';
import { WS_EVENTS } from '../../common/ws/ws-events';

@Injectable()
export class AdminStatsWsHandler {
  constructor(private readonly stats: GameStatsService) {}

  async statsResetAll(session: WsSession) {
    requireAdmin(session);
    const { deletedPlayers, deletedMatches } = await this.stats.resetAllStats();
    return {
      type: WS_EVENTS.admin.stats.resetAll,
      payload: { ok: true, deletedPlayers, deletedMatches },
    };
  }
}

