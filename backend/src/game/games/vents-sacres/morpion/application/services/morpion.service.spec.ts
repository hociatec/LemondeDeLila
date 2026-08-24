import { MorpionService } from './morpion.service';
import { MorpionPresenter } from './morpion.presenter';
import { GridCellActionsService } from '../../../../../application/features/grid/services/grid-cell-actions.service';
import { MORPION_PAWNS } from '../../definitions/morpion.pawns';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';

function makeService(): MorpionService {
  return new MorpionService(
    new MorpionPresenter(new GridCellActionsService()),
    new GameCoreService(),
    new SetupFlowService(),
  );
}

describe('MorpionService', () => {
  it('starts pawn selection with a human even if a bot is first', async () => {
    const service = makeService();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Bot', isBot: true },
        { id: 2, username: 'Human' },
      ],
      log: [],
      metadata: {},
    } as any);

    expect(state.pending?.type).toBe('choose_pawn');
    expect(state.pending?.playerId).toBe(2);
    expect(state.turn?.currentPlayerId).toBe(2);
    const messages = (state.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );
    expect(
      messages.some((message: string) =>
        message.startsWith('Bot a choisi le pion: '),
      ),
    ).toBe(true);
    expect(messages).toContain("C'est à Human de choisir son pion.");
  });

  it('requires pawn selection before exposing playable cells', async () => {
    const service = makeService();

    let state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    const chooserId = state.pending?.playerId ?? null;
    expect([1, 2]).toContain(chooserId);
    const otherId = chooserId === 1 ? 2 : 1;

    const exposedChooser: any = service.exposeStateForUser(state, chooserId);
    const exposedOther: any = service.exposeStateForUser(state, otherId);

    expect((exposedChooser.actions ?? []).length).toBe(MORPION_PAWNS.length);
    expect((exposedOther.actions ?? []).length).toBe(0);

    const choose = (actorId: number, pawnId: string) =>
      ({ type: 'choose_pawn', payload: { pawnId }, meta: { actorId } }) as any;

    state = service.applyActions(state, [
      choose(chooserId, MORPION_PAWNS[0].id),
    ]);
    let messages = (state.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );
    expect(messages).toContain(
      `C'est à ${otherId === 1 ? 'A' : 'B'} de choisir son pion.`,
    );
    state = service.applyActions(state, [choose(otherId, MORPION_PAWNS[1].id)]);
    messages = (state.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );
    expect(messages).toContain(
      `${otherId === 1 ? 'A' : 'B'} a choisi le pion: ${MORPION_PAWNS[1].label}.`,
    );

    const exposedAfterSetup: any = service.exposeStateForUser(state, 1);
    expect((exposedAfterSetup.actions ?? []).length).toBe(9);
  });

  it('logs a chooser prompt before each automatic bot pawn choice', async () => {
    const service = makeService();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Bot', isBot: true },
        { id: 2, username: 'Human' },
      ],
      log: [],
      metadata: {},
    } as any);

    const messages = (state.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );
    const botPromptIndex = messages.findIndex(
      (message: string) => message === "C'est à Bot de choisir son pion.",
    );
    const botChoiceIndex = messages.findIndex((message: string) =>
      message.startsWith('Bot a choisi le pion: '),
    );

    expect(botPromptIndex).toBeGreaterThanOrEqual(0);
    expect(botChoiceIndex).toBeGreaterThan(botPromptIndex);
  });

  it('detects a winner', async () => {
    const service = makeService();

    let state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    const play = (actorId: number, x: number, y: number) =>
      ({ type: 'morpion_play', payload: { x, y }, meta: { actorId } }) as any;
    const choose = (actorId: number, pawnId: string) =>
      ({ type: 'choose_pawn', payload: { pawnId }, meta: { actorId } }) as any;

    const chooserId = state.pending?.playerId ?? 1;
    const otherId = chooserId === 1 ? 2 : 1;
    state = service.applyActions(state, [
      choose(chooserId, MORPION_PAWNS[0].id),
    ]);
    state = service.applyActions(state, [choose(otherId, MORPION_PAWNS[1].id)]);

    state = service.applyActions(state, [play(1, 0, 0)]);
    state = service.applyActions(state, [play(2, 0, 1)]);
    state = service.applyActions(state, [play(1, 1, 0)]);
    state = service.applyActions(state, [play(2, 1, 1)]);
    state = service.applyActions(state, [play(1, 2, 0)]);

    expect(String(state.status)).toBe('finished');
    expect(state.metadata.winnerId).toBe(1);
  });

  it('logs correct cell refs (A1..C3) with inverted rows', async () => {
    const service = makeService();

    let state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    const choose = (actorId: number, pawnId: string) =>
      ({ type: 'choose_pawn', payload: { pawnId }, meta: { actorId } }) as any;
    const play = (actorId: number, x: number, y: number) =>
      ({ type: 'morpion_play', payload: { x, y }, meta: { actorId } }) as any;

    const chooserId = state.pending?.playerId ?? 1;
    const otherId = chooserId === 1 ? 2 : 1;
    state = service.applyActions(state, [
      choose(chooserId, MORPION_PAWNS[0].id),
    ]);
    state = service.applyActions(state, [choose(otherId, MORPION_PAWNS[1].id)]);

    const expected: Array<[number, number, string]> = [
      [0, 0, 'A3'],
      [1, 0, 'B3'],
      [2, 0, 'C3'],
      [0, 1, 'A2'],
      [1, 1, 'B2'],
      [2, 1, 'C2'],
      [0, 2, 'A1'],
      [1, 2, 'B1'],
      [2, 2, 'C1'],
    ];

    for (const [x, y, cellRef] of expected) {
      const base: any = {
        ...state,
        status: 'started',
        pending: null,
        log: [],
        metadata: {
          ...(state.metadata ?? {}),
          board: Array.from({ length: 9 }, () => 0),
          winnerId: null,
          draw: false,
        },
      };
      const next: any = service.applyActions(base, [play(1, x, y)]);
      const last = next.log?.[next.log.length - 1]?.message ?? '';
      expect(String(last)).toContain(` en ${cellRef}.`);
    }
  });

  it('suggests a bot move on its turn', async () => {
    const service = makeService();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Human' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      log: [],
      metadata: {},
    } as any);

    const choose = (actorId: number, pawnId: string) =>
      ({ type: 'choose_pawn', payload: { pawnId }, meta: { actorId } }) as any;

    // Bot pawns are auto-assigned. Finish human pawn selection, then force bot turn for move suggestion.
    const next = service.applyActions(state, [
      choose(1, MORPION_PAWNS[0].id),
    ]) as any;
    next.turn.currentPlayerId = 2;

    const actions = service.getBotActions(next, 2);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].type).toBe('morpion_play');
  });

  it('exposes ui panels for info shortcuts', async () => {
    const service = makeService();

    const state: any = service.hydrateInitialState({
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      log: [],
      metadata: {},
    } as any);

    const choose = (actorId: number, pawnId: string) =>
      ({ type: 'choose_pawn', payload: { pawnId }, meta: { actorId } }) as any;
    const chooserId = state.pending?.playerId ?? 1;
    const otherId = chooserId === 1 ? 2 : 1;
    let configured: any = service.applyActions(state, [
      choose(chooserId, MORPION_PAWNS[0].id),
    ]);
    configured = service.applyActions(configured, [
      choose(otherId, MORPION_PAWNS[1].id),
    ]);

    const exposed: any = service.exposeStateForUser(configured, 1);
    expect(exposed?.extras?.ui?.panels?.position).toBeUndefined();
    expect(exposed?.extras?.ui?.panels?.play?.message).toContain(
      'Cases libres',
    );
  });
});





