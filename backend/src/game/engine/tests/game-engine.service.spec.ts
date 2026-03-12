import { BadRequestException } from '@nestjs/common';
import { GameEngineService } from '../services/game-engine.service';
import { GameCoreService } from '../../core/services/game-core.service';
import { BoardPayloadService } from '../../modules/board/services/board-payload.service';

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
  it('announces the next pawn chooser even if a previous pawn prompt is still recent', () => {
    const engine = new GameEngineService(
      {} as any,
      new GameCoreService(),
      { getHandler: jest.fn(() => ({})) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new BoardPayloadService(),
      {} as any,
    );

    const state: any = {
      status: 'started',
      turnIndex: 1,
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Mouche' },
      ],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: { type: 'choose_pawn', playerId: 2, blocking: true },
      log: [
        { message: "C'est à Lilas de choisir son pion." },
        { message: "C'est au tour de Lilas." },
        { message: '[Panier Express] Lilas a choisi le pion: panier en osier.' },
      ],
      metadata: {},
    };

    const out = (engine as any).appendFirstTurnAnnouncement(state);
    const messages = (out.log ?? []).map((entry: any) => String(entry?.message));

    expect(messages).toContain("C'est à Mouche de choisir son pion.");
  });

  it('does not duplicate the same pawn chooser announcement', () => {
    const engine = new GameEngineService(
      {} as any,
      new GameCoreService(),
      { getHandler: jest.fn(() => ({})) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new BoardPayloadService(),
      {} as any,
    );

    const state: any = {
      status: 'started',
      turnIndex: 1,
      players: [{ id: 2, username: 'Mouche' }],
      turn: { currentPlayerId: 2, direction: 1 },
      pending: { type: 'choose_pawn', playerId: 2, blocking: true },
      log: [{ message: "C'est à Mouche de choisir son pion." }],
      metadata: {},
    };

    const out = (engine as any).appendFirstTurnAnnouncement(state);

    expect(out).toBe(state);
  });

  it('returns a fallback turn message on T even when panels are missing', async () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      { getHandler: jest.fn(() => ({})) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new BoardPayloadService(),
      {} as any,
    );

    (engine as any).getStateForUser = jest.fn().mockResolvedValue({
      status: 'started',
      players: [{ id: 1, username: 'Lila' }],
      turn: { currentPlayerId: 1, direction: 1 },
      extras: {},
      log: [],
    });

    const out = await engine.handleKeyPress(1, 'any', 1, 'T');
    expect(out).toEqual({
      kind: 'panel',
      panelId: 'turn',
      message: 'À toi de jouer.',
    });
  });

  it('returns fallback score/hand panel messages from extras when ui.panels are missing', async () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {
        getHandler: jest.fn(() => ({
          getShortcuts: jest.fn(() => [
            { key: 'S', type: 'interface', id: 'score' },
            { key: 'E', type: 'interface', id: 'hand' },
          ]),
        })),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new BoardPayloadService(),
      {} as any,
    );

    (engine as any).getStateForUser = jest.fn().mockResolvedValue({
      status: 'started',
      players: [{ id: 1, username: 'Lila' }],
      turn: { currentPlayerId: 1, direction: 1 },
      extras: {
        hand: ['1', 'LAMA'],
        score: ['Total jetons: 4', 'Lila: 4'],
      },
      log: [],
    });

    const score = await engine.handleKeyPress(1, 'any', 1, 'S');
    const hand = await engine.handleKeyPress(1, 'any', 1, 'E');

    expect(score).toEqual({
      kind: 'panel',
      panelId: 'score',
      message: 'Score : Total jetons: 4 | Lila: 4.',
    });
    expect(hand).toEqual({
      kind: 'panel',
      panelId: 'hand',
      message: 'Main : 1, LAMA.',
    });
  });

  it('ignores a stale ENTER roll shortcut when fresh internal state says it is not the player turn', async () => {
    const handler = {
      validateAction: jest.fn(() => {
        throw new Error("Ce n'est pas votre tour.");
      }),
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
      {} as any,
      {} as any,
      new BoardPayloadService(),
      {} as any,
    );

    (engine as any).getStateForUser = jest.fn().mockResolvedValue({
      status: 'started',
      players: [
        { id: 1, username: 'hacene' },
        { id: -2, username: 'Ratatouille', isBot: true },
      ],
      turn: { currentPlayerId: -2, direction: 1 },
      actions: [{ type: 'roll', payload: {} }],
      extras: {},
      log: [],
    });
    (engine as any).getInternalState = jest.fn().mockResolvedValue({
      status: 'started',
      players: [
        { id: 1, username: 'hacene' },
        { id: -2, username: 'Ratatouille', isBot: true },
      ],
      turn: { currentPlayerId: -2, direction: 1 },
      metadata: {},
      log: [],
      extras: {},
    });

    const out = await engine.handleKeyPress(1, 'galopons-ensemble', 1, 'ENTER');

    expect(out).toBeNull();
    expect(handler.validateAction).toHaveBeenCalledWith(
      expect.objectContaining({
        turn: { currentPlayerId: -2, direction: 1 },
      }),
      { type: 'roll', payload: {} },
      1,
    );
  });

  it('rebuilds the P panel from the internal game state when a game exposes only one position', async () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {
        getHandler: jest.fn(() => ({
          getShortcuts: jest.fn(() => [
            { key: 'P', type: 'interface', id: 'position' },
          ]),
        })),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    (engine as any).getStateForUser = jest.fn().mockResolvedValue({
      status: 'started',
      players: [{ id: 1, username: 'hacene' }],
      turn: { currentPlayerId: 1, direction: 1 },
      extras: {
        ui: {
          panels: {
            position: {
              title: 'Position',
              message: 'Positions. hacene : Tour plateau ?, case 3/40.',
            },
          },
        },
      },
      board: {
        tiles: new Array(40).fill({}),
        positions: { 1: 2 },
      },
      log: [],
    });
    (engine as any).getInternalState = jest.fn().mockResolvedValue({
      status: 'started',
      players: [
        { id: 1, username: 'hacene' },
        { id: 2, username: 'Lila' },
      ],
      metadata: {
        tiles: new Array(40).fill({}),
        positions: { 1: 2, 2: 5 },
      },
    });

    const out = await engine.handleKeyPress(1, 'any', 1, 'P');
    expect(out).toEqual({
      kind: 'panel',
      panelId: 'position',
      message:
        'Positions. hacene : Tour plateau ?, case 3/40. Lila : Tour plateau ?, case 6/40.',
    });
  });

  it('injects a canonical global position panel in exposed state for user', () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {
        getHandler: jest.fn(() => ({
          exposeStateForUser: jest.fn((state: any) => ({
            ...state,
            extras: {
              ui: {
                panels: {
                  position: {
                    title: 'Position',
                    message: 'Positions. hacene : Tour plateau ?, case 3/40.',
                  },
                },
              },
            },
          })),
        })),
      } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      { attachGridRenderDescriptors: jest.fn((s) => s) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const exposed = (engine as any).exposeStateForUser(
      {
        status: 'started',
        players: [
          { id: 1, username: 'hacene' },
          { id: 2, username: 'Lila' },
        ],
        turn: { currentPlayerId: 1, direction: 1 },
        metadata: {
          tiles: new Array(40).fill({}),
          positions: { 1: 2, 2: 5 },
        },
      },
      'any',
      1,
    );

    expect(exposed?.extras?.ui?.panels?.position?.message).toBe(
      'Positions. hacene : Tour plateau ?, case 3/40. Lila : Tour plateau ?, case 6/40.',
    );
  });

  it('rebuilds the P panel from pawn progress metadata for all players', async () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {
        getHandler: jest.fn(() => ({
          getShortcuts: jest.fn(() => [
            { key: 'P', type: 'interface', id: 'position' },
          ]),
        })),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    (engine as any).getStateForUser = jest.fn().mockResolvedValue({
      status: 'started',
      players: [{ id: 1, username: 'hacene' }],
      turn: { currentPlayerId: 1, direction: 1 },
      extras: {
        ui: {
          panels: {
            position: {
              title: 'Position',
              message: 'Position locale.',
            },
          },
        },
      },
      log: [],
    });
    (engine as any).getInternalState = jest.fn().mockResolvedValue({
      status: 'started',
      players: [
        { id: 1, username: 'hacene' },
        { id: 2, username: 'Lila' },
      ],
      metadata: {
        trackLength: 40,
        homeLength: 4,
        offsets: { 1: 0, 2: 10 },
        pawnsByPlayer: {
          1: [{ pawnIndex: 0, progress: 2 }],
          2: [{ pawnIndex: 1, progress: 5 }],
        },
      },
    });

    const out = await engine.handleKeyPress(1, 'any', 1, 'P');
    expect(out).toEqual({
      kind: 'panel',
      panelId: 'position',
      message:
        'Positions. hacene : Départ 0/1, Abri 0/1, Arrivée 0/1, Piste Pion 1 case 3/40. Lila : Départ 0/1, Abri 0/1, Arrivée 0/1, Piste Pion 2 case 16/40.',
    });
  });

  it('rebuilds the P panel from grid coordinates for all players', async () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {
        getHandler: jest.fn(() => ({
          getShortcuts: jest.fn(() => [
            { key: 'P', type: 'interface', id: 'position' },
          ]),
        })),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    (engine as any).getStateForUser = jest.fn().mockResolvedValue({
      status: 'started',
      players: [{ id: 1, username: 'hacene' }],
      turn: { currentPlayerId: 1, direction: 1 },
      extras: {
        ui: {
          panels: {
            position: {
              title: 'Position',
              message: 'Position locale.',
            },
          },
        },
      },
      log: [],
    });
    (engine as any).getInternalState = jest.fn().mockResolvedValue({
      status: 'started',
      players: [
        { id: 1, username: 'hacene' },
        { id: 2, username: 'Lila' },
      ],
      metadata: {
        size: 9,
        pawnsByPlayerId: {
          1: { x: 4, y: 8 },
          2: { x: 4, y: 0 },
        },
      },
    });

    const out = await engine.handleKeyPress(1, 'any', 1, 'P');
    expect(out).toEqual({
      kind: 'panel',
      panelId: 'position',
      message: 'Positions. hacene e1. Lila e9.',
    });
  });

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
      buildBaseState: jest.fn((payload: any, gameType: string) => ({
        status: String(payload?.room?.status ?? 'started'),
        players: Array.isArray(payload?.room?.players)
          ? payload.room.players
          : [],
        turn: {
          currentPlayerId: payload?.room?.players?.[0]?.id ?? null,
          direction: 1,
        },
        turnIndex: 0,
        metadata: {
          gameType,
          roomId: payload?.room?.id ?? 0,
          roomStartedAt: payload?.room?.startedAt ?? null,
          statuses: { skipTurn: {} },
          turnFlow: { skipped: [] },
        },
        log: [],
      })),
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
      hydrateInitialState: jest.fn((state: any) => state),
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

    const firstMessages = (first.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );
    const secondMessages = (second.log ?? []).map((e: any) =>
      String(e?.message ?? ''),
    );

    expect(firstMessages.some((m) => m.includes('passe son tour'))).toBe(false);
    expect(secondMessages.some((m) => m.includes('passe son tour'))).toBe(
      false,
    );
    expect(handler.applyActions).toHaveBeenCalledTimes(2);
    expect(stateRef.metadata?.turnFlow?.skipped ?? []).toEqual([]);
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
      new BoardPayloadService(),
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

  it("rÃ©ordonne les joueurs sautÃ©s avant l'annonce du prochain tour", () => {
    const engine = new GameEngineService(
      {} as any,
      new GameCoreService(),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new BoardPayloadService(),
      {} as any,
    );

    const state: any = {
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Clover' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      log: [{ message: "C'est au tour de Lilas." }],
      metadata: {
        turnFlow: {
          skipped: [{ id: 2, remainingAfter: 0 }],
        },
      },
    };

    const out = (engine as any).appendSkipTurnAnnouncements(state);
    const messages = (out.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(messages).toEqual([
      'Clover passe son tour.',
      "C'est au tour de Lilas.",
    ]);
    expect(out.metadata?.turnFlow?.skipped ?? []).toEqual([]);
  });

  it("annonce les cases de contes et cacahuÃ¨tes sans numÃ©ro de case", () => {
    const engine = new GameEngineService(
      {} as any,
      new GameCoreService(),
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new BoardPayloadService(),
      {} as any,
    );

    const previous: any = {
      players: [{ id: 1, username: 'Lilas' }],
      status: 'started',
      metadata: {
        gameType: 'contes-et-cacahuetes',
        positions: { 1: -1 },
        tiles: [
          {
            label:
              "Case DÃ©part: Vous ouvrez le grand livre des contes, et un vent de magie emporte vos feuilles volantes Chaque pas vous rapproche d'histoires fantastiques, de surprises et de rires Ã  profusion. L'aventure commence maintenant !",
          },
        ],
      },
      log: [],
    };
    const next: any = {
      players: [{ id: 1, username: 'Lilas' }],
      status: 'started',
      metadata: {
        gameType: 'contes-et-cacahuetes',
        positions: { 1: 0 },
        tiles: [
          {
            label:
              "Case DÃ©part: Vous ouvrez le grand livre des contes, et un vent de magie emporte vos feuilles volantes Chaque pas vous rapproche d'histoires fantastiques, de surprises et de rires Ã  profusion. L'aventure commence maintenant !",
          },
        ],
      },
      log: [],
    };
    const handler: any = {
      shouldAnnounceBoardArrivals: jest.fn(() => true),
    };

    const out = (engine as any).appendBoardArrivalAnnouncements(
      'contes-et-cacahuetes',
      handler,
      previous,
      next,
    );
    const messages = (out.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(messages.some((message: string) => message.includes('Case Départ'))).toBe(
      true,
    );
    expect(messages.some((message: string) => message.includes('case 1 -'))).toBe(
      false,
    );
  });

  it('silently ignores unavailable actions when actor is out of turn', async () => {
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
      turn: { currentPlayerId: 2, direction: 1 },
      metadata: { gameType: 'frousse-party', roomId: 1 },
    };
    const handler: any = {
      getAvailableActions: jest.fn(() => [{ type: 'roll', payload: {} }]),
    };

    const out = await (engine as any).validateActions(
      state,
      handler,
      [{ type: 'play_card', payload: { cardId: 'x' } }],
      1,
    );

    expect(out).toEqual([]);
  });

  it('rejects unavailable action when actor is in turn (pending blocker scenario)', async () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { set: jest.fn() } as any,
      {
        logValidationFailure: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      } as any,
      {} as any,
    );

    const state: any = {
      turn: { currentPlayerId: 1, direction: 1 },
      pending: { type: 'draw', playerId: 1, blocking: true },
      metadata: { gameType: 'frousse-party', roomId: 1 },
    };
    const handler: any = {
      getAvailableActions: jest.fn(() => [{ type: 'draw', payload: {} }]),
    };

    await expect(
      (engine as any).validateActions(
        state,
        handler,
        [{ type: 'play_card', payload: { cardId: 'x' } }],
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('silently ignores game validation errors for out-of-turn messages', async () => {
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
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: { gameType: 'frousse-party', roomId: 1 },
    };
    const handler: any = {
      getAvailableActions: jest.fn(() => [{ type: 'play_card', payload: {} }]),
      validateAction: jest.fn(() => {
        throw new Error("Ce n'est pas votre tour.");
      }),
    };

    const out = await (engine as any).validateActions(
      state,
      handler,
      [{ type: 'play_card', payload: { cardId: 'x' } }],
      1,
    );

    expect(out).toEqual([]);
  });

  it('returns current state (no error) when a player acts out of turn', async () => {
    const current: any = {
      status: 'started',
      turnIndex: 0,
      log: [],
      players: [
        { id: 1, username: 'A', isBot: false },
        { id: 2, username: 'B', isBot: false },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: { gameType: 'frousse-party', roomId: 1 },
    };

    const engine = new GameEngineService(
      {} as any,
      {} as any,
      {
        getHandler: jest.fn(() => ({
          getAvailableActions: jest.fn(() => []),
          validateActor: jest.fn(() => false),
        })),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    (engine as any).getInternalState = jest.fn(async () => current);
    (engine as any).normalizeBotThinking = jest.fn(async () => current);
    (engine as any).exposeState = jest.fn(() => current);

    const out = await (engine as any).applyActionsInternal(
      1,
      'frousse-party',
      [{ type: 'roll', payload: {} }],
      2,
      false,
    );

    expect(out).toBe(current);
    expect((engine as any).exposeState).toHaveBeenCalledWith(
      current,
      'frousse-party',
    );
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
          room: {
            id: 1,
            gameType: 'corridor',
            status: 'started',
            startedAt: new Date().toISOString(),
          },
        })
        .mockResolvedValueOnce({
          room: {
            id: 1,
            gameType: 'corridor',
            status: 'setup',
            startedAt: null,
          },
        }),
      resetRoomSystem: jest
        .fn()
        .mockResolvedValue({ id: 1, status: 'setup', startedAt: null }),
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

  it('keeps a freshly finished game state during grace window before auto-reset', async () => {
    const now = new Date().toISOString();
    const rooms = {
      getRoomPayload: jest.fn().mockResolvedValue({
        room: {
          id: 1,
          gameType: 'corridor',
          status: 'started',
          startedAt: now,
        },
      }),
      resetRoomSystem: jest.fn(),
      notifyRoomStateUpdated: jest.fn(),
    };

    const store = {
      buildKey: jest.fn(() => '1:corridor'),
      delete: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue({
        status: 'finished',
        turnIndex: 1,
        players: [],
        turn: { currentPlayerId: null, direction: 1 },
        metadata: {
          roomStartedAt: now,
          finishedAt: now,
          winnerId: 1,
        },
      }),
      set: jest.fn().mockResolvedValue(undefined),
      markBotThinking: jest.fn((state: any) => state),
      syncRoomStatus: jest.fn((state: any) => state),
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
      {} as any,
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

    const state = await (engine as any).getInternalState(1, 'corridor');

    expect(state.status).toBe('finished');
    expect(rooms.resetRoomSystem).not.toHaveBeenCalled();
    expect(store.delete).not.toHaveBeenCalled();
    expect(botScheduler.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        key: '1:corridor:finished-reset',
        delayMs: 5000,
        roomId: 1,
        gameType: 'corridor',
      }),
    );
  });

  it('keeps negative-id room bots when syncing a started roster', () => {
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
      status: 'started',
      turnIndex: 4,
      players: [
        { id: 1, username: 'Hacene', isBot: false },
        { id: -7, username: 'IdÃ©fix', isBot: true },
      ],
      turn: { currentPlayerId: -7, direction: 1 },
      metadata: {},
      log: [],
      extras: {},
    };
    const payload: any = {
      room: {
        players: [{ id: 1, username: 'Hacene' }],
        bots: [{ id: 7, name: 'IdÃ©fix' }],
      },
    };

    const next = (engine as any).syncRosterForStartedRoom(state, payload);
    const bot = (next.players ?? []).find((p: any) => p?.id === -7);

    expect(bot).toBeDefined();
    expect(bot?.isBot).toBe(true);
    expect(next.turn?.currentPlayerId).toBe(-7);
  });

  it('keeps negative-id room bots by id even when bot name changed', () => {
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
      status: 'started',
      turnIndex: 8,
      players: [
        { id: 1, username: 'Hacene', isBot: false },
        { id: -11, username: 'Idefix', isBot: true },
      ],
      turn: { currentPlayerId: -11, direction: 1 },
      metadata: {},
      log: [],
      extras: {},
    };
    const payload: any = {
      room: {
        players: [{ id: 1, username: 'Hacene' }],
        bots: [{ id: 11, name: 'IdÃ©fix' }],
      },
    };

    const next = (engine as any).syncRosterForStartedRoom(state, payload);
    const bot = (next.players ?? []).find((p: any) => p?.id === -11);

    expect(bot).toBeDefined();
    expect(bot?.isBot).toBe(true);
    expect(next.turn?.currentPlayerId).toBe(-11);
  });

  it('sets metadata.lifecycle.startReady to false while config prompt is pending', () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      { getHandler: jest.fn(() => null) } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      { attachGridRenderDescriptors: jest.fn((s: any) => s) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const state: any = {
      status: 'started',
      phase: 'setup',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      players: [{ id: 1, username: 'Lila', isBot: false }],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: { type: 'config_prompt', playerId: 1, blocking: true },
      metadata: { gameType: 'lama', roomId: 1 },
      extras: {},
      log: [],
    };

    const exposed = (engine as any).exposeState(state, 'lama');
    expect(exposed?.metadata?.lifecycle?.startReady).toBe(false);
    expect(exposed?.metadata?.lifecycle?.viewerTurnActionable).toBe(false);
    expect(exposed?.metadata?.lifecycle?.viewerMustChoosePawn).toBe(false);
  });

  it('sets metadata.lifecycle.startReady to true once started state has no config prompt', () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      { getHandler: jest.fn(() => null) } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      { attachGridRenderDescriptors: jest.fn((s: any) => s) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 1,
      lastRoll: null,
      players: [{ id: 1, username: 'Lila', isBot: false }],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
      metadata: { gameType: 'lama', roomId: 1 },
      extras: {},
      log: [],
    };

    const exposed = (engine as any).exposeState(state, 'lama');
    expect(exposed?.metadata?.lifecycle?.startReady).toBe(true);
    expect(exposed?.metadata?.lifecycle?.viewerTurnActionable).toBe(false);
    expect(exposed?.metadata?.lifecycle?.viewerMustChoosePawn).toBe(false);
  });

  it('sets metadata.lifecycle.viewerTurnActionable for the requesting user', () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      { getHandler: jest.fn(() => null) } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      { attachGridRenderDescriptors: jest.fn((s: any) => s) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 2,
      botThinking: false,
      players: [{ id: 1, username: 'Lila', isBot: false }],
      turn: { currentPlayerId: 1, direction: 1 },
      actions: [{ type: 'lama_play', payload: {} }],
      pending: null,
      metadata: { gameType: 'lama', roomId: 1 },
      extras: {},
      log: [],
    };

    const exposed = (engine as any).exposeStateForUser(state, 'lama', 1);
    expect(exposed?.metadata?.lifecycle?.startReady).toBe(true);
    expect(exposed?.metadata?.lifecycle?.viewerTurnActionable).toBe(true);
    expect(exposed?.metadata?.lifecycle?.viewerMustChoosePawn).toBe(false);
  });

  it('sets metadata.lifecycle.viewerMustChoosePawn for pawn selection pending', () => {
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      { getHandler: jest.fn(() => null) } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      { attachGridRenderDescriptors: jest.fn((s: any) => s) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const state: any = {
      status: 'started',
      phase: 'round',
      round: 1,
      turnIndex: 3,
      botThinking: false,
      players: [{ id: 1, username: 'Lila', isBot: false }],
      turn: { currentPlayerId: 1, direction: 1 },
      actions: [{ type: 'choose_pawn', payload: {} }],
      pending: { type: 'choose_pawn', playerId: 1, blocking: true },
      metadata: { gameType: 'corridor', roomId: 1 },
      extras: {},
      log: [],
    };

    const exposed = (engine as any).exposeStateForUser(state, 'corridor', 1);
    expect(exposed?.metadata?.lifecycle?.viewerMustChoosePawn).toBe(true);
    expect(exposed?.metadata?.lifecycle?.viewerTurnActionable).toBe(false);
  });

  it('builds ended payload with profile endgame messages for human players', async () => {
    const socialProfiles = {
      find: jest.fn().mockResolvedValue([
        { userId: 1, victoryMessage: 'Bravo toi !', defeatMessage: null },
        { userId: 2, victoryMessage: null, defeatMessage: 'On recommence.' },
      ]),
    };
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      { getHandler: jest.fn(() => null) } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      { attachGridRenderDescriptors: jest.fn((s: any) => s) } as any,
      {} as any,
      {} as any,
      {} as any,
      new BoardPayloadService(),
      socialProfiles as any,
    );

    const state: any = {
      status: 'finished',
      turnIndex: 8,
      players: [
        { id: 1, username: 'Lila', isBot: false },
        { id: 2, username: 'Milo', isBot: false },
        { id: 99, username: 'Bot', isBot: true },
      ],
      metadata: {
        winnerId: 1,
        outcomesByPlayerId: { '1': 'won', '2': 'lost' },
      },
    };

    const payload = await (engine as any).buildEndedPayload(
      7,
      'morpion',
      state,
    );

    expect(payload.winnerPlayerId).toBe(1);
    expect(payload.endgameMessagesByPlayerId).toEqual({
      '1': { victoryMessage: 'Bravo toi !', defeatMessage: null },
      '2': { victoryMessage: null, defeatMessage: 'On recommence.' },
    });
    expect(socialProfiles.find).toHaveBeenCalledTimes(1);
  });

  it('ignores profile message lookup failures when building ended payload', async () => {
    const socialProfiles = {
      find: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const engine = new GameEngineService(
      {} as any,
      {} as any,
      { getHandler: jest.fn(() => null) } as any,
      { compute: jest.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      { attachGridRenderDescriptors: jest.fn((s: any) => s) } as any,
      {} as any,
      {} as any,
      {} as any,
      new BoardPayloadService(),
      socialProfiles as any,
    );

    const payload = await (engine as any).buildEndedPayload(1, 'lama', {
      status: 'finished',
      turnIndex: 1,
      players: [{ id: 1, username: 'Lila', isBot: false }],
      metadata: { winnerId: 1, outcomesByPlayerId: { '1': 'won' } },
    });

    expect(payload.endgameMessagesByPlayerId).toEqual({});
  });
});


