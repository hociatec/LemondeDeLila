import type { GameRuntime } from '../../../application/ports/game-runtime.port';
import type { GameState } from '../../../application/models/game-state.model';
import { GameWsHandler } from './game-ws.handler';

describe('GameWsHandler internal state refresh version', () => {
  const state = (version: number): GameState => ({
    status: 'setup',
    phase: 'setup',
    version,
    log: [],
    metadata: { roomRunId: 2 },
  });

  const setup = (
    knownVersion: number,
    commandRebaseFromVersion?: number,
    actionType = 'choice.resolve',
  ) => {
    const resolved = {
      gameType: 'lama',
      state: state(2),
      handler: {} as GameRuntime,
      ...(commandRebaseFromVersion == null ? {} : { commandRebaseFromVersion }),
    };
    const actions = [
      {
        type: actionType,
        payload:
          actionType === 'choice.resolve'
            ? { value: 'capitaine-cacahuete' }
            : { startingHandSize: 6 },
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

  it('accepts a pawn choice based on the state immediately before an internal roster refresh', async () => {
    const test = setup(1, 1);

    await test.handler.action({ user: { id: 7 } } as never, {});

    expect(test.executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            type: 'choice.resolve',
            meta: expect.objectContaining({ knownVersion: 2 }),
          }),
        ],
      }),
    );
    expect(test.realtime.commit).toHaveBeenCalledTimes(1);
  });

  it('also rebases game configuration after the same internal refresh', async () => {
    const test = setup(1, 1, 'game.configure');

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
  });

  it('rebases the first action after the start timestamp is persisted', async () => {
    const test = setup(1, 1, 'choice.resolve');

    await test.handler.action({ user: { id: 7 } } as never, {});

    expect(test.executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            meta: expect.objectContaining({ knownVersion: 2 }),
          }),
        ],
      }),
    );
  });

  it('does not hide a genuinely stale action version', async () => {
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
