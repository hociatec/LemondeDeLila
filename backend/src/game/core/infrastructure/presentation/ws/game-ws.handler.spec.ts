import type { GameRuntime } from '../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../application/contracts/game-state.model';
import { GameWsHandler } from './game-ws.handler';

describe('GameWsHandler setup configuration version', () => {
  const state = (version: number): GameStateEntity => ({
    status: 'setup',
    phase: 'setup',
    version,
    log: [],
    metadata: { roomRunId: 2 },
  });

  const setup = (
    knownVersion: number,
    setupRosterRefreshedFromVersion?: number,
  ) => {
    const resolved = {
      gameType: 'lama',
      state: state(2),
      handler: {} as GameRuntime,
      ...(setupRosterRefreshedFromVersion == null
        ? {}
        : { setupRosterRefreshedFromVersion }),
    };
    const actions = [
      {
        type: 'game.configure',
        payload: { startingHandSize: 6 },
        meta: { actorId: 7, commandId: 'configure-1', knownVersion },
      },
    ];
    const executor = {
      execute: jest.fn().mockReturnValue(state(2)),
    };
    const realtime = {
      resolve: jest.fn().mockResolvedValue(resolved),
      bind: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new GameWsHandler(
      {} as never,
      {} as never,
      {} as never,
      {
        resolveRoomId: jest.fn().mockReturnValue(4),
        resolveActions: jest.fn().mockReturnValue(actions),
      } as never,
      realtime as never,
      { ensureWritable: jest.fn().mockResolvedValue(undefined) } as never,
      executor as never,
      {
        run: jest.fn((_roomId, operation) => operation()),
      } as never,
    );
    return { handler, executor, realtime };
  };

  it('accepts configuration based on the state immediately before an internal roster refresh', async () => {
    const test = setup(1, 1);

    await test.handler.action({ user: { id: 7 } } as never, {});

    expect(test.executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            type: 'game.configure',
            meta: expect.objectContaining({ knownVersion: 2 }),
          }),
        ],
      }),
    );
    expect(test.realtime.commit).toHaveBeenCalledTimes(1);
  });

  it('does not hide a genuinely stale configuration version', async () => {
    const test = setup(0, 1);

    await test.handler.action({ user: { id: 7 } } as never, {});

    expect(test.executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            meta: expect.objectContaining({ knownVersion: 0 }),
          }),
        ],
      }),
    );
  });
});
