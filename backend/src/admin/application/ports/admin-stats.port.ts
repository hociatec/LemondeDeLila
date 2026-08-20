export interface AdminStatsPort {
  resetAllStats(): Promise<{
    deletedPlayers: number;
    deletedMatches: number;
  }>;
}

export const ADMIN_STATS_PORT = Symbol('ADMIN_STATS_PORT');
