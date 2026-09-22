import { Logger } from '@nestjs/common';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import { GameAutomationRecoveryService } from './game-automation-recovery.service';
import { prometheusMetrics } from '../../../../platform/observability/public-api';

function fixture() {
  const sessions = {
    listAfter: jest.fn(async () => [{ roomId: 1, gameType: 'example' }]),
  };
  const state = { version: 7, status: 'started', metadata: { roomRunId: 2 } };
  const engine = {
    exportInternalState: jest.fn(
      async (_roomId: number, _gameType: string) => state,
    ),
    clearInternalStateIf: jest.fn(async () => undefined),
  };
  const handler = { gameType: 'example' };
  const registry = { getHandler: jest.fn(() => handler) };
  const automation = { schedule: jest.fn() };
  const shutdown = new ApplicationShutdownService();
  const rooms = { isCurrent: jest.fn(async () => true) };
  const lease = {
    isHeld: jest.fn(async () => true),
    release: jest.fn(async () => {}),
  };
  const leases = { acquire: jest.fn(async () => lease) };
  const service = new GameAutomationRecoveryService(
    sessions,
    engine as never,
    registry as never,
    automation as never,
    shutdown,
    rooms,
    leases,
  );
  return {
    service,
    sessions,
    engine,
    state,
    handler,
    registry,
    automation,
    shutdown,
    rooms,
    lease,
    leases,
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('clears quarantine metrics when a failed SQL session disappears from a complete sweep', async () => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const pass = jest.spyOn(prometheusMetrics.recovery, 'pass');
  const f = fixture();
  f.engine.exportInternalState.mockRejectedValueOnce(
    new Error('invalid session'),
  );
  await f.service.recover();
  expect(pass).toHaveBeenLastCalledWith(expect.any(Number), 1);
  f.sessions.listAfter.mockResolvedValueOnce([]);
  await f.service.recover();
  expect(pass).toHaveBeenLastCalledWith(expect.any(Number), 0);
});

it('retains quarantine when the SQL sweep fails before completion', async () => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const pass = jest.spyOn(prometheusMetrics.recovery, 'pass');
  const f = fixture();
  f.engine.exportInternalState.mockRejectedValueOnce(
    new Error('invalid session'),
  );
  await f.service.recover();
  f.sessions.listAfter.mockRejectedValueOnce(new Error('database unavailable'));
  await f.service.recover();
  expect(pass).toHaveBeenLastCalledWith(expect.any(Number), 1);
  await f.service.recover();
  expect(f.engine.exportInternalState).toHaveBeenCalledTimes(1);
  expect(pass).toHaveBeenLastCalledWith(expect.any(Number), 1);
});

it('reconstructs delivery from persisted state again after a lost scheduler write', async () => {
  const f = fixture();
  await f.service.recover();
  await f.service.recover();
  expect(f.automation.schedule).toHaveBeenCalledTimes(2);
  expect(f.automation.schedule).toHaveBeenLastCalledWith({
    roomId: 1,
    gameType: 'example',
    handler: f.handler,
    state: f.state,
  });
});

it('retries database failures and isolates unreadable sessions', async () => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const f = fixture();
  f.sessions.listAfter.mockRejectedValueOnce(new Error('database unavailable'));
  await f.service.recover();
  expect(f.automation.schedule).not.toHaveBeenCalled();
  f.sessions.listAfter.mockResolvedValueOnce([
    { roomId: 1, gameType: 'example' },
    { roomId: 2, gameType: 'example' },
  ]);
  f.engine.exportInternalState.mockRejectedValueOnce(
    new Error('invalid session'),
  );
  await f.service.recover();
  expect(f.automation.schedule).toHaveBeenCalledTimes(1);
  expect(f.automation.schedule).toHaveBeenCalledWith(
    expect.objectContaining({ roomId: 2 }),
  );
  await jest.advanceTimersByTimeAsync(5_000);
  await f.service.recover();
  expect(f.automation.schedule).toHaveBeenCalledWith(
    expect.objectContaining({ roomId: 1 }),
  );
});

it('advances a bounded cursor and resets it at the end of the sweep', async () => {
  const f = fixture();
  f.sessions.listAfter.mockResolvedValueOnce(
    Array.from({ length: 100 }, (_, i) => ({
      roomId: i + 1,
      gameType: 'example',
    })),
  );
  f.sessions.listAfter.mockResolvedValueOnce([]);
  await f.service.recover();
  await f.service.recover();
  expect(f.sessions.listAfter.mock.calls).toEqual([
    [null, 100],
    [{ roomId: 100, gameType: 'example' }, 100],
    [null, 100],
  ]);
});

it('does not overlap scans or accept work during shutdown', async () => {
  const f = fixture();
  await Promise.all([f.service.recover(), f.service.recover()]);
  expect(f.sessions.listAfter).toHaveBeenCalledTimes(1);
  f.shutdown.stopAccepting();
  await f.service.recover();
  expect(f.sessions.listAfter).toHaveBeenCalledTimes(1);
});

it('reconciles obsolete sessions without requiring a delivered reset or delete event', async () => {
  const f = fixture();
  f.rooms.isCurrent.mockResolvedValue(false);
  await f.service.recover();
  expect(f.engine.clearInternalStateIf).toHaveBeenCalledWith(
    1,
    'example',
    f.state,
  );
  expect(f.automation.schedule).not.toHaveBeenCalled();
  f.rooms.isCurrent.mockResolvedValue(true);
  await f.service.recover();
  expect(f.engine.clearInternalStateIf).toHaveBeenCalledTimes(1);
  expect(f.automation.schedule).toHaveBeenCalledTimes(1);
});

it('does not treat an unavailable room database as a deleted room', async () => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const f = fixture();
  f.rooms.isCurrent.mockRejectedValueOnce(new Error('database unavailable'));
  await f.service.recover();
  expect(f.engine.clearInternalStateIf).not.toHaveBeenCalled();
  expect(f.automation.schedule).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(5_000);
  await f.service.recover();
  expect(f.automation.schedule).toHaveBeenCalledTimes(1);
});

it('allows only one recovery instance to scan at a time', async () => {
  const first = fixture();
  const second = fixture();
  let held = false;
  const acquire = async () => {
    if (held) return null;
    held = true;
    return {
      isHeld: async () => held,
      release: async () => {
        held = false;
      },
    };
  };
  first.leases.acquire.mockImplementation(acquire as never);
  second.leases.acquire.mockImplementation(acquire as never);
  await Promise.all([first.service.recover(), second.service.recover()]);
  expect(
    first.sessions.listAfter.mock.calls.length +
      second.sessions.listAfter.mock.calls.length,
  ).toBe(1);
  expect(held).toBe(false);
});

it('stops scheduling after lease loss and releases the lease on SQL errors', async () => {
  const f = fixture();
  f.lease.isHeld
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValue(false);
  await f.service.recover();
  expect(f.automation.schedule).not.toHaveBeenCalled();
  expect(f.lease.release).toHaveBeenCalledTimes(1);
  f.lease.isHeld.mockResolvedValue(true);
  f.sessions.listAfter.mockRejectedValueOnce(new Error('SQL unavailable'));
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  await f.service.recover();
  expect(f.lease.release).toHaveBeenCalledTimes(2);
});

it('caps a dense scan at ten pages and continues from its cursor', async () => {
  const f = fixture();
  let page = 0;
  f.sessions.listAfter.mockImplementation(async () =>
    Array.from({ length: 100 }, (_, index) => ({
      roomId: page * 100 + index + 1,
      gameType: 'example',
    })).map((key, index, keys) => {
      if (index === keys.length - 1) page++;
      return key;
    }),
  );
  await f.service.recover();
  expect(f.sessions.listAfter).toHaveBeenCalledTimes(10);
  expect(f.automation.schedule).toHaveBeenCalledTimes(1_000);
  f.sessions.listAfter.mockResolvedValueOnce([]);
  await f.service.recover();
  expect(f.sessions.listAfter).toHaveBeenLastCalledWith(
    { roomId: 1_000, gameType: 'example' },
    100,
  );
});

it('quarantines unreadable runtimes without starving healthy sessions or leaking secrets', async () => {
  const f = fixture();
  const log = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});
  f.sessions.listAfter.mockResolvedValue([
    { roomId: 1, gameType: 'missing' },
    { roomId: 2, gameType: 'example' },
  ]);
  f.engine.exportInternalState.mockImplementation(async (roomId: number) => {
    if (roomId === 1) throw new Error('redis://user:password@host');
    return f.state;
  });
  await f.service.recover();
  await f.service.recover();
  expect(log).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(log.mock.calls)).not.toContain('password');
  expect(f.automation.schedule).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(5_000);
  await f.service.recover();
  expect(log).toHaveBeenCalledTimes(2);
});

it('stops the jittered poll and refuses manual scans after destruction', async () => {
  const f = fixture();
  f.service.onApplicationBootstrap();
  expect(jest.getTimerCount()).toBe(1);
  f.service.onModuleDestroy();
  await jest.advanceTimersByTimeAsync(60_000);
  await f.service.recover();
  expect(f.sessions.listAfter).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('preserves an unknown runtime until it becomes available again', async () => {
  const f = fixture();
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  f.registry.getHandler.mockReturnValueOnce(undefined as never);
  await f.service.recover();
  expect(f.engine.clearInternalStateIf).not.toHaveBeenCalled();
  expect(f.automation.schedule).not.toHaveBeenCalled();
  await f.service.recover();
  expect(f.registry.getHandler).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(5_000);
  await f.service.recover();
  expect(f.automation.schedule).toHaveBeenCalledTimes(1);
});

it('visits ten thousand sessions without skipping or repeating keys within a sweep', async () => {
  const f = fixture();
  const keys = Array.from({ length: 10_000 }, (_, index) => ({
    roomId: index + 1,
    gameType: 'example',
  }));
  f.sessions.listAfter.mockImplementation(async (...args: unknown[]) => {
    const cursor = args[0] as { roomId: number } | null;
    return keys
      .filter((key) => key.roomId > (cursor?.roomId ?? 0))
      .slice(0, 100);
  });
  for (let pass = 0; pass < 11; pass++) {
    const before = f.sessions.listAfter.mock.calls.length;
    await f.service.recover();
    expect(f.sessions.listAfter.mock.calls.length - before).toBeLessThanOrEqual(
      10,
    );
  }
  expect(
    f.automation.schedule.mock.calls.map(([input]) => input.roomId),
  ).toEqual(keys.map((key) => key.roomId));
});

it('yields within a slow page and resumes at the first unprocessed session', async () => {
  const f = fixture();
  f.sessions.listAfter.mockResolvedValue(
    Array.from({ length: 100 }, (_, index) => ({
      roomId: index + 1,
      gameType: 'example',
    })),
  );
  f.engine.exportInternalState.mockImplementation(async () => {
    jest.advanceTimersByTime(20);
    return f.state;
  });
  await f.service.recover();
  expect(f.sessions.listAfter).toHaveBeenCalledTimes(1);
  expect(f.automation.schedule).toHaveBeenCalledTimes(50);
  f.sessions.listAfter.mockResolvedValueOnce([]);
  await f.service.recover();
  expect(f.sessions.listAfter).toHaveBeenLastCalledWith(
    { roomId: 50, gameType: 'example' },
    100,
  );
});

it.each(['lease', 'shutdown', 'destroy'])(
  'does not delete an obsolete session after %s while SQL was pending',
  async (cause) => {
    const f = fixture();
    f.rooms.isCurrent.mockImplementation(async () => {
      if (cause === 'lease') f.lease.isHeld.mockResolvedValue(false);
      if (cause === 'shutdown') f.shutdown.stopAccepting();
      if (cause === 'destroy') f.service.onModuleDestroy();
      return false;
    });
    await f.service.recover();
    expect(f.engine.clearInternalStateIf).not.toHaveBeenCalled();
    expect(f.automation.schedule).not.toHaveBeenCalled();
    expect(f.lease.release).toHaveBeenCalledTimes(1);
  },
);

it('drains an accepted recovery read and does not schedule after shutdown starts', async () => {
  const f = fixture();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  f.engine.exportInternalState.mockImplementation(async () => {
    await pending;
    return f.state;
  });
  const recovery = f.service.recover();
  while (!f.engine.exportInternalState.mock.calls.length)
    await Promise.resolve();
  f.shutdown.stopAccepting();
  let drained = false;
  const drain = f.shutdown.drain().then(() => {
    drained = true;
  });
  await Promise.resolve();
  expect(drained).toBe(false);
  finish();
  await Promise.all([recovery, drain]);
  expect(f.automation.schedule).not.toHaveBeenCalled();
  expect(f.lease.release).toHaveBeenCalledTimes(1);
  expect(drained).toBe(true);
});
