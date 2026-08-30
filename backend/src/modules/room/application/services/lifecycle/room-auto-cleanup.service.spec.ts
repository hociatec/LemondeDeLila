import { RoomAutoCleanupService } from './room-auto-cleanup.service';

describe('RoomAutoCleanupService durability policy', () => {
  function createService(cleanup: jest.Mock) {
    return new RoomAutoCleanupService(
      { createContext: () => ({ actor: 'system' }) } as never,
      { adminCleanupRooms: cleanup } as never,
      {
        get: () => ({
          autoCleanupEnabled: true,
          autoCleanupIntervalSeconds: 300,
          autoCleanupOlderThanMinutes: 60,
          autoCleanupLimit: 100,
        }),
      } as never,
    );
  }

  it('recomputes eligible rooms from durable state on every fresh instance', async () => {
    const cleanup = jest.fn().mockResolvedValue({ deleted: 0, matched: 0 });
    const first = createService(cleanup);
    const restarted = createService(cleanup);

    await (first as unknown as { tick: () => Promise<void> }).tick();
    await (restarted as unknown as { tick: () => Promise<void> }).tick();

    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenNthCalledWith(
      2,
      { actor: 'system' },
      expect.objectContaining({ dryRun: false, excludeActivePlayers: true }),
    );
  });
});
