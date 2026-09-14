import { RoomAutoCleanupService } from './room-auto-cleanup.service';

describe('RoomAutoCleanupService durability policy', () => {
  function createService(cleanup: jest.Mock, now: () => number = Date.now) {
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
      undefined,
      { now },
    );
  }

  it('respects the cleanup interval even when the first run is at epoch zero', async () => {
    let now = 0;
    const cleanup = jest.fn().mockResolvedValue({ deleted: 0, matched: 0 });
    const service = createService(cleanup, () => now);
    const tick = () =>
      (service as unknown as { tick: () => Promise<void> }).tick();
    await tick();
    now = 299_999;
    await tick();
    expect(cleanup).toHaveBeenCalledTimes(1);
    now = 300_000;
    await tick();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

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
      expect.objectContaining({
        dryRun: false,
        excludeActivePlayers: true,
        includePrivate: true,
        includeStarted: true,
      }),
    );
  });

  it('recovers private rooms left behind when an in-memory disconnect expires', async () => {
    const cleanup = jest.fn().mockResolvedValue({ deleted: 1, matched: 1 });
    const service = createService(cleanup);

    await (service as unknown as { tick: () => Promise<void> }).tick();

    expect(cleanup).toHaveBeenCalledWith(
      { actor: 'system' },
      expect.objectContaining({
        includePrivate: true,
        olderThanMinutes: 60,
        excludeActivePlayers: true,
      }),
    );
  });

  it('releases both recurring and initial timers during shutdown', () => {
    jest.useFakeTimers();
    try {
      const service = createService(jest.fn());
      service.onModuleInit();
      expect(jest.getTimerCount()).toBe(2);

      void service.onModuleDestroy();

      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
