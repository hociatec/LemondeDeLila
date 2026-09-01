import type { GameRuntime } from '../../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../../application/contracts/game-state.model';
import { GameRoomStateFactory } from '../../../../application/services/game-room-state.factory';
import { appendPendingGameEvent } from '../../../../application/services/game-event-log.helper';
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

  it('rebuilds an unconfigured setup state after a bot is added', async () => {
    const current = {
      ...gameState({ roomRunId: 2 }),
      status: 'setup',
      phase: 'setup',
      version: 1,
      players: [{ id: 1, username: 'Owner', isBot: false }],
    };
    const handler = {
      hydrateInitialState: jest.fn((state) => state),
    } as unknown as GameRuntime;
    const engine = {
      exportInternalState: jest.fn().mockResolvedValue(current),
      compareAndSetInternalState: jest.fn(
        async (_roomId, _gameType, expectedVersion, state) => ({
          committed: true,
          version: expectedVersion + 1,
          state: { ...state, version: expectedVersion + 1 },
        }),
      ),
    };
    const room = {
      room: {
        id: 4,
        gameType: 'lama',
        status: 'setup',
        runId: 1,
        owner: { id: 1 },
        players: [{ id: 1, username: 'Owner' }],
        bots: [{ id: 9, name: 'Bot LAMA' }],
      },
    };
    const service = new GameWsRealtimeStateService(
      new GameRoomStateFactory(),
      engine as never,
      { getHandler: jest.fn().mockReturnValue(handler) } as never,
      { clear: jest.fn() } as never,
      {} as never,
      {} as never,
      { buildPayload: jest.fn().mockResolvedValue(room) } as never,
      execution() as never,
    );

    const resolved = await service.resolve(4);

    expect(resolved.state.players).toEqual([
      { id: 1, username: 'Owner', isBot: false },
      { id: -9, username: 'Bot LAMA', isBot: true },
    ]);
    expect(resolved.setupRosterRefreshedFromVersion).toBe(1);
    expect(handler.hydrateInitialState).toHaveBeenCalledTimes(1);
    expect(engine.compareAndSetInternalState).toHaveBeenCalledWith(
      4,
      'lama',
      1,
      expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ id: -9, isBot: true }),
        ]),
      }),
    );
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

  it('broadcasts transient command events after the store drains them', async () => {
    const previous = {
      ...gameState({ roomRunId: 2 }),
      version: 4,
    };
    const next = gameState({ roomRunId: 2 });
    appendPendingGameEvent(next, {
      type: 'game.message',
      data: {
        key: 'game.card.drawn',
        params: { playerId: 1, cardLabel: 'LAMA' },
      },
      actorId: 1,
      visibility: { kind: 'public' },
      occurredAtMs: 10,
    });
    const persisted = structuredClone(next);
    delete (
      persisted as GameStateEntity & {
        engine?: { pendingEvents?: unknown };
      }
    ).engine?.pendingEvents;
    persisted.version = 5;
    const presenter = { present: jest.fn().mockReturnValue({}) };
    const hub = {
      listConnections: jest.fn().mockReturnValue([
        {
          connectionId: 'one',
          meta: { scope: 'game', roomId: 4, userId: 1 },
        },
      ]),
      send: jest.fn(),
    };
    const automation = { schedule: jest.fn() };
    const service = new GameWsRealtimeStateService(
      {} as never,
      {
        compareAndSetInternalState: jest.fn().mockResolvedValue({
          committed: true,
          version: 5,
          state: persisted,
        }),
      } as never,
      {} as never,
      automation as never,
      presenter as never,
      hub as never,
      {} as never,
      execution() as never,
    );
    const handler = {} as GameRuntime;

    await service.commit(
      4,
      { gameType: 'lama', state: previous, handler },
      previous,
      next,
    );

    expect(presenter.present).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          version: 5,
          engine: expect.objectContaining({
            pendingEvents: expect.arrayContaining([
              expect.objectContaining({ type: 'game.message' }),
            ]),
          }),
        }),
      }),
    );
    expect(automation.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ state: persisted }),
    );
  });

  it('prepares the room for bots and a new configuration after game finish', async () => {
    const previous = {
      ...gameState({ roomRunId: 2 }),
      version: 4,
    };
    const next = {
      ...gameState({ roomRunId: 2 }),
      status: 'finished',
    };
    const persisted = { ...next, version: 5 };
    const rooms = { prepareNextRun: jest.fn().mockResolvedValue(undefined) };
    const hub = {
      listConnections: jest.fn().mockReturnValue([
        {
          connectionId: 'owner',
          meta: { scope: 'game', roomId: 4, userId: 1 },
        },
      ]),
      send: jest.fn(),
    };
    const service = new GameWsRealtimeStateService(
      {} as never,
      {
        compareAndSetInternalState: jest.fn().mockResolvedValue({
          committed: true,
          version: 5,
          state: persisted,
        }),
      } as never,
      {} as never,
      { schedule: jest.fn() } as never,
      { present: jest.fn().mockReturnValue({ status: 'finished' }) } as never,
      hub as never,
      rooms as never,
      execution() as never,
    );

    await service.commit(
      4,
      { gameType: 'lama', state: previous, handler: {} as GameRuntime },
      previous,
      next,
    );

    expect(hub.send).toHaveBeenCalledWith(
      'owner',
      expect.objectContaining({ type: 'game.state' }),
    );
    expect(rooms.prepareNextRun).toHaveBeenCalledWith(4);
    expect(hub.send.mock.invocationCallOrder[0]).toBeLessThan(
      rooms.prepareNextRun.mock.invocationCallOrder[0],
    );
  });

  it('also prepares the room when an automatic action finishes the game', async () => {
    let committedHandler:
      | ((input: {
          roomId: number;
          gameType: string;
          handler: GameRuntime;
          state: GameStateEntity;
          version: number;
        }) => Promise<void> | void)
      | undefined;
    const automation = {
      setStateCommittedHandler: jest.fn((handler) => {
        committedHandler = handler;
      }),
    };
    const rooms = { prepareNextRun: jest.fn().mockResolvedValue(undefined) };
    new GameWsRealtimeStateService(
      {} as never,
      {} as never,
      {} as never,
      automation as never,
      { present: jest.fn() } as never,
      { listConnections: jest.fn().mockReturnValue([]) } as never,
      rooms as never,
      execution() as never,
    );

    await committedHandler?.({
      roomId: 4,
      gameType: 'lama',
      handler: {} as GameRuntime,
      state: { ...gameState({ roomRunId: 2 }), status: 'finished' },
      version: 5,
    });

    expect(rooms.prepareNextRun).toHaveBeenCalledWith(4);
  });
});
