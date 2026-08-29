import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_STATS_PORT,
  type AdminStatsPort,
} from '../../ports/admin-stats.port';

@Injectable()
export class AdminStatsService {
  constructor(
    @Inject(ADMIN_STATS_PORT)
    private readonly stats: AdminStatsPort,
  ) {}

  async resetAll() {
    const { deletedPlayers, deletedMatches } = await this.stats.resetAllStats();
    return {
      ok: true,
      deletedPlayers,
      deletedMatches,
    };
  }
}
