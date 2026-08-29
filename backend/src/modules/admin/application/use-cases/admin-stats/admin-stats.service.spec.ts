import { AdminStatsService } from './admin-stats.service';

describe('AdminStatsService', () => {
  it('returns the admin reset payload', async () => {
    const stats = {
      resetAllStats: jest.fn(async () => ({
        deletedPlayers: 12,
        deletedMatches: 7,
      })),
    };
    const service = new AdminStatsService(stats as any);

    const result = await service.resetAll();

    expect(result).toEqual({
      ok: true,
      deletedPlayers: 12,
      deletedMatches: 7,
    });
  });
});
