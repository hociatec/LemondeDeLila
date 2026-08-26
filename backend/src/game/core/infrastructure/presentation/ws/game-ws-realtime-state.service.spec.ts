import type { GameRuntime } from '../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import { GameRoomStateFactory } from '../../../application/services/game-room-state.factory';
import { GameWsRealtimeStateService } from './game-ws-realtime-state.service';

describe('GameWsRealtimeStateService run isolation', () => {
  const gameState = (
    metadata: GameStateEntity['metadata'],
    game: object = {},
  ): GameStateEntity => ({
    status: 'started',
    phase: 'playing',
    log: [],
    metadata,
    game,
  });
  const execution = () => ({
    create: jest.fn((state, actorId) => ({ state, actorId })),
    run: jest.fn((_context, operation) => operation()),
  });
  const roomPayload = (runId: number, status = 'started') => ({
    room: { id: 4, gameType: 'lama', status, runId },
  });

  it('discards a snapshot from the previous room run', async () => {
    const stale = {
      ...gameState({ roomRunId: 1 }),
      log: [{ message: 'Ancienne partie.' }],
    };
    const base = gameState({ roomRunId: 2 });
    const fresh = { ...base };
    const hydrateInitialState = jest.fn().mockReturnValue(fresh);
    const handler = {
      hydrateInitialState,
    } as unknown as GameRuntime;
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(stale),
      clearInternalState: jest.fn().mockResolvedValue(undefined),
      restoreInternalState: jest.fn().mockResolvedValue(undefined),
    };
    const automation = { clear: jest.fn() };
    const service = new GameWsRealtimeStateService(
      { build: jest.fn().mockReturnValue(base) } as never,
      engine as never,
      { getHandler: jest.fn().mockReturnValue(handler) } as never,
      automation as never,
      {} as never,
      {} as never,
      { buildPayload: jest.fn().mockResolvedValue(roomPayload(2)) } as never,
      execution() as never,
    );

    const resolved = await service.resolve(4);

    expect(automation.clear).toHaveBeenCalledWith(4, 'lama');
    expect(engine.clearInternalState).toHaveBeenCalledWith(4, 'lama');
    expect(hydrateInitialState).toHaveBeenCalledWith(
      base,
      expect.objectContaining({ actorId: null, state: base }),
    );
    expect(engine.restoreInternalState).toHaveBeenCalledWith(4, 'lama', fresh);
    expect(resolved.state).toBe(fresh);
  });

  it('keeps a snapshot belonging to the current room run', async () => {
    const current = {
      ...gameState({ roomRunId: 2 }),
      log: [{ message: 'Partie actuelle.' }],
    };
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(current),
    };
    const handler = {} as GameRuntime;
    const automation = { clear: jest.fn() };
    const service = new GameWsRealtimeStateService(
      {} as never,
      engine as never,
      { getHandler: jest.fn().mockReturnValue(handler) } as never,
      automation as never,
      {} as never,
      {} as never,
      { buildPayload: jest.fn().mockResolvedValue(roomPayload(2)) } as never,
      execution() as never,
    );

    const resolved = await service.resolve(4);

    expect(resolved.state).toBe(current);
    expect(automation.clear).not.toHaveBeenCalled();
  });

  it('keeps configured setup state when the room starts its reserved run', async () => {
    let stored: GameStateEntity | null = null;
    const hydrateInitialState = jest.fn((state) => state);
    const handler = {
      hydrateInitialState,
    } as unknown as GameRuntime;
    const engine = {
      exportInternalState: jest.fn(async () => stored),
      clearInternalState: jest.fn(async () => {
        stored = null;
      }),
      restoreInternalState: jest.fn(async (_roomId, _gameType, state) => {
        stored = state;
      }),
      compareAndSetInternalState: jest.fn(
        async (_roomId, _gameType, expectedVersion, state) => {
          state.version = expectedVersion + 1;
          stored = state;
          return {
            committed: true,
            version: state.version,
            state,
          };
        },
      ),
    };
    const automation = { clear: jest.fn(), schedule: jest.fn() };
    const setupRoom = {
      room: {
        ...roomPayload(2, 'setup').room,
        startedAt: null,
        owner: { id: 1 },
        players: [{ id: 1, username: 'Owner' }],
        bots: [],
      },
    };
    const startedRoom = {
      room: {
        ...setupRoom.room,
        status: 'started',
        runId: 3,
        startedAt: new Date(0).toISOString(),
      },
    };
    const rooms = {
      buildPayload: jest
        .fn()
        .mockResolvedValueOnce(setupRoom)
        .mockResolvedValueOnce(startedRoom),
    };
    const service = new GameWsRealtimeStateService(
      new GameRoomStateFactory(),
      engine as never,
      { getHandler: jest.fn().mockReturnValue(handler) } as never,
      automation as never,
      {} as never,
      { listConnections: jest.fn().mockReturnValue([]) } as never,
      rooms as never,
      execution() as never,
    );

    const setup = await service.resolve(4);
    expect(setup.state.metadata?.roomRunId).toBe(3);
    const configured = {
      ...setup.state,
      status: 'started',
      phase: 'round',
      metadata: { roomRunId: 3 },
      game: { configured: true },
    } satisfies GameStateEntity;
    await service.commit(4, setup, setup.state, configured);

    const started = await service.resolve(4);

    expect(started.state).toBe(configured);
    expect(started.state.game).toEqual({ configured: true });
    expect(engine.clearInternalState).not.toHaveBeenCalled();
    expect(hydrateInitialState).toHaveBeenCalledTimes(1);
  });

  it('preserves the run marker when a game replaces metadata during hydration', async () => {
    const base = gameState({ roomRunId: 2 });
    const fresh = gameState({ generatedAt: 'setup-config' });
    const handler = {
      hydrateInitialState: jest.fn().mockReturnValue(fresh),
    } as unknown as GameRuntime;
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(null),
      restoreInternalState: jest.fn().mockResolvedValue(undefined),
    };
    const service = new GameWsRealtimeStateService(
      { build: jest.fn().mockReturnValue(base) } as never,
      engine as never,
      { getHandler: jest.fn().mockReturnValue(handler) } as never,
      {} as never,
      {} as never,
      {} as never,
      { buildPayload: jest.fn().mockResolvedValue(roomPayload(2)) } as never,
      execution() as never,
    );

    const resolved = await service.resolve(4);

    expect(resolved.state.metadata?.generatedAt).toBe('setup-config');
    expect(resolved.state.metadata?.roomRunId).toBe(2);
    expect(engine.restoreInternalState).toHaveBeenCalledWith(4, 'lama', fresh);
  });

  it('preserves the run marker when an action replaces metadata', async () => {
    const previous = {
      ...gameState({ roomRunId: 2, generatedAt: 'setup-config' }),
      version: 4,
    };
    const next = gameState({ generatedAt: 'turn-choice' });
    const handler = {} as GameRuntime;
    const engine = {
      compareAndSetInternalState: jest.fn(
        async (_roomId, _gameType, expectedVersion, state) => {
          state.version = expectedVersion + 1;
          return {
            committed: true,
            version: state.version,
            state,
          };
        },
      ),
    };
    const automation = { schedule: jest.fn() };
    const service = new GameWsRealtimeStateService(
      {} as never,
      engine as never,
      {} as never,
      automation as never,
      {} as never,
      { listConnections: jest.fn().mockReturnValue([]) } as never,
      {} as never,
      execution() as never,
    );

    await service.commit(
      4,
      { gameType: 'lama', state: previous, handler },
      previous,
      next,
    );

    expect(next.metadata?.generatedAt).toBe('turn-choice');
    expect(next.metadata?.roomRunId).toBe(2);
    expect(next.version).toBe(5);
    expect(engine.compareAndSetInternalState).toHaveBeenCalledWith(
      4,
      'lama',
      4,
      next,
    );
  });
});
