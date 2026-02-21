import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { GameStatsService } from '../../stats/services/game-stats.service';

@Injectable()
export class AdminStatsWsHandler {
  constructor(private readonly stats: GameStatsService) {}

  async statsResetAll(session: WsSession) {
    requireAdmin(session);
    const { deletedPlayers, deletedMatches } = await this.stats.resetAllStats();
    return {
      type: 'admin.stats.resetAll',
      payload: { ok: true, deletedPlayers, deletedMatches },
    };
  }
}
