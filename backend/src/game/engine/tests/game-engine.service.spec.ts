import { BadRequestException } from '@nestjs/common';
import { GameEngineService } from '../services/game-engine.service';

jest.mock(
  'winston',
  () => ({
    createLogger: () => ({
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    }),
    format: {
      combine: (...args: any[]) => args,
      timestamp: jest.fn(() => jest.fn()),
      errors: jest.fn(() => jest.fn()),
      json: jest.fn(() => jest.fn()),
      colorize: jest.fn(() => jest.fn()),
      printf: jest.fn(() => jest.fn()),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  }),
  { virtual: true },
);

describe('GameEngineService', () => {
  it('does not replay stale skip-turn announcements on subsequent actions', async () => {
    const startedAt = '2026-02-09T00:00:00.000Z';
    const players = [
      { id: 1, username: 'hacene', isBot: false },
      { id: 2, username: 'Polynesia', isBot: false },
    ];

    let stateRef: any = {
      status: 'started',
      turnIndex: 0,
      players,
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: {
        gameType: 'frousse-party',
        roomId: 1,
        roomStartedAt: startedAt,
        statuses: { skipTurn: {} },
        turnFlow: {
          skipped: [{ id: 2, remainingBefore: 1, remainingAfter: 0 }],
        },
      },
      log: [],
      extras: {},
    };

    const rooms = {
      getRoomPayload: jest.fn().mockResolvedValue({
        room: {
          id: 1,
          gameType: 'frousse-party',
          status: 'started',
          startedAt,
          players,
          bots: [],
        },
      }),
      resetRoomSystem: jest.fn(),
      notifyRoomStateUpdated: jest.fn(),
    };

    const core = {
      buildBaseState: jest.fn(),
      appendLog: jest.fn((state: any, message: string) => ({
        ...state,
        log: [...(Array.isArray(state?.log) ? state.log : []), { message }],
      })),
    };

    const store = {
      buildKey: jest.fn(() => '1:frousse-party'),
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(async () => stateRef),
      set: jest.fn(async (_roomId: number, _gameType: string, next: any) => {
        stateRef = next;
      }),
      markBotThinking: jest.fn((state: any) => state),
      syncRoomStatus: jest.fn((state: any) => state),
    };

    let actionTick = 0;
    const handler = {
      getAvailableActions: jest.fn(() => [{ type: 'roll', payload: {} }]),
      validateAction: jest.fn((_state: any, action: any) => action),
      applyActions: jest.fn(async (state: any) =>
        core.appendLog(state, `action-${++actionTick}`),
      ),
    };

    const botScheduler = {
      clear: jest.fn(),
      has: jest.fn(() => false),
      schedule: jest.fn(),
    };

    const gameLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      logPlayerAction: jest.fn(),
      logValidationFailure: jest.fn(),
    };

    const engine = new GameEngineService(
      rooms as any,
      core as any,
      { getHandler: jest.fn(() => handler) } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      botScheduler as any,
      { getBotTurnDelayMs: jest.fn(() => 0) } as any,
      { attachGridRenderDescriptors: jest.fn((s: any) => s) } as any,
      store as any,
      gameLogger as any,
      { finalizeFinished: jest.fn() } as any,
    );

    const first = (await engine.applyActions(
      1,
      'frousse-party',
      [{ type: 'roll', payload: {} }],
      1,
      false,
    )) as any;
    const second = (await engine.applyActions(
      1,
      'frousse-party',
      [{ type: 'roll', payload: {} }],
      1,
      false,
    )) as any;

    const firstMessages = (first.log ?? []).map((e: any) => String(e?.message ?? ''));
    const secondMessages = (second.log ?? []).map((e: any) => String(e?.message ?? ''));

    expect(firstMessages.at(-1)).toBe('Polynesia passe son tour.');
    expect(secondMessages.at(-1)).toBe('action-2');
    expect((stateRef.metadata as any)?.turnFlow?.skipped ?? []).toEqual([]);
  });

  it('silently ignores unavailable draw action (even with payload)', async () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const state: any = {
      metadata: { gameType: 'frousse-party', roomId: 1 },
    };
    const handler: any = {
      getAvailableActions: jest.fn(() => [{ type: 'roll', payload: {} }]),
    };

    const out = await (engine as any).validateActions(
      state,
      handler,
      [{ type: 'draw', payload: { deck: 'any' } }],
      1,
    );

    expect(out).toEqual([]);
  });

  it('does not mark botThinking when a blocking pending action targets a human', async () => {
    const state: any = {
      status: 'started',
      turnIndex: 0,
      players: [
        { id: -1, username: 'Bot', isBot: true },
        { id: 1, username: 'Lilas', isBot: false },
      ],
      turn: { currentPlayerId: -1, direction: 1 },
      pending: { type: 'choose_pawn', playerId: 1, blocking: true },
      metadata: {},
    };

    const store = {
      markBotThinking: jest.fn((s: any, botThinking: boolean) => ({
        ...s,
        botThinking,
      })),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const handler = {
      getAvailableActions: jest.fn((s: any, playerId: number) =>
        playerId === 1 && s.pending?.type === 'choose_pawn'
          ? [{ type: 'choose_pawn', payload: { pawnId: 'x' } }]
          : [],
      ),
    };

    const engine = new GameEngineService(
      {} as any,
      {} as any,
      { getHandler: jest.fn(() => handler) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      store as any,
      {} as any,
      {} as any,
    );

    const marked = await (engine as any).markBotThinking(
      1,
      'frousse-party',
      state,
      true,
    );

    expect(store.markBotThinking).toHaveBeenCalledWith(state, false);
    expect(marked.botThinking).toBe(false);
  });

  it('rejects gameType mismatches for a room', async () => {
    const rooms = {
      getRoomPayload: jest.fn().mockResolvedValue({
        room: { gameType: 'corridor' },
      }),
    };
    const botScheduler = { clear: jest.fn() };
    const store = {
      buildKey: jest.fn(() => '1:generic'),
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      markBotThinking: jest.fn((state: any) => state),
      syncRoomStatus: jest.fn((_state: any) => _state),
    };
    const gameLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      logPlayerAction: jest.fn(),
      logValidationFailure: jest.fn(),
    };

    const engine = new GameEngineService(
      rooms as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      botScheduler as any,
      {} as any,
      {} as any,
      store as any,
      gameLogger as any,
      {} as any,
    );

    let err: unknown;
    try {
      await engine.getState(1, 'generic');
    } catch (e) {
      err = e;
    }
    if (!(err instanceof BadRequestException)) {
      throw err;
    }
    expect(botScheduler.clear).toHaveBeenCalled();
    expect(store.delete).toHaveBeenCalled();
  });

  it('auto-resets a stale finished game when the room is still started', async () => {
    const rooms = {
      getRoomPayload: jest
        .fn()
        .mockResolvedValueOnce({
          room: { id: 1, gameType: 'corridor', status: 'started', startedAt: new Date().toISOString() },
        })
        .mockResolvedValueOnce({
          room: { id: 1, gameType: 'corridor', status: 'setup', startedAt: null },
        }),
      resetRoomSystem: jest.fn().mockResolvedValue({ id: 1, status: 'setup', startedAt: null }),
      notifyRoomStateUpdated: jest.fn().mockResolvedValue(undefined),
    };

    const store = {
      buildKey: jest.fn(() => '1:corridor'),
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({
        status: 'finished',
        turnIndex: 1,
        players: [],
        turn: { currentPlayerId: null, direction: 1 },
        metadata: { roomStartedAt: new Date().toISOString() },
      }),
      set: jest.fn().mockResolvedValue(undefined),
      markBotThinking: jest.fn((state: any) => state),
      syncRoomStatus: jest.fn((state: any) => state),
    };

    const core = {
      buildBaseState: jest.fn(() => ({
        status: 'setup',
        turnIndex: 0,
        players: [],
        turn: { currentPlayerId: null, direction: 1 },
        metadata: {},
        log: [],
        extras: {},
      })),
      appendLog: jest.fn((state: any) => state),
    };

    const botScheduler = { clear: jest.fn(), has: jest.fn(() => false), schedule: jest.fn() };
    const gameLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      logPlayerAction: jest.fn(),
      logValidationFailure: jest.fn(),
    };

    const engine = new GameEngineService(
      rooms as any,
      core as any,
      { getHandler: jest.fn(() => null) } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      botScheduler as any,
      { getBotTurnDelayMs: jest.fn(() => 0) } as any,
      { attachGridRenderDescriptors: jest.fn((s: any) => s) } as any,
      store as any,
      gameLogger as any,
      { finalizeFinished: jest.fn() } as any,
    );

    await (engine as any).getInternalState(1, 'corridor');

    expect(rooms.resetRoomSystem).toHaveBeenCalledWith(1);
    expect(rooms.notifyRoomStateUpdated).toHaveBeenCalledWith(1);
    expect(store.delete).toHaveBeenCalledWith(1, 'corridor');
  });
});
