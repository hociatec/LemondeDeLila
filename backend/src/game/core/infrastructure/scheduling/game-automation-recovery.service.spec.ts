import { Logger } from '@nestjs/common';
import { ApplicationShutdownService } from '../../../../platform/lifecycle/public-api';
import { GameAutomationRecoveryService } from './game-automation-recovery.service';

function fixture() {
  const sessions = {
    listAfter: jest.fn(async () => [{ roomId: 1, gameType: 'example' }]),
  };
  const state = { version: 7, status: 'started' };
  const engine = { exportInternalState: jest.fn(async () => state) };
  const handler = { gameType: 'example' };
  const registry = { getHandler: jest.fn(() => handler) };
  const automation = { schedule: jest.fn() };
  const shutdown = new ApplicationShutdownService();
  const service = new GameAutomationRecoveryService(
    sessions,
    engine as never,
    registry as never,
    automation as never,
    shutdown,
  );
  return { service, sessions, engine, state, handler, automation, shutdown };
}

afterEach(() => jest.restoreAllMocks());

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
  await f.service.recover();
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
