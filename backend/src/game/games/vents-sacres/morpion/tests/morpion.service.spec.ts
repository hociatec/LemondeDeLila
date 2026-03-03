import { MorpionService } from '../morpion.service';
import { MorpionPresenter } from '../morpion.presenter';
import { GridCellActionsService } from '../../../../modules/grid/services/grid-cell-actions.service';

describe('MorpionService', () => {
  it('requires pawn selection before exposing playable cells', async () => {
    const service = new MorpionService(
      { register: () => {} } as any,
      new MorpionPresenter(new GridCellActionsService()),
    );

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

    const exposedA: any = service.exposeStateForUser(state, 1);
    const exposedB: any = service.exposeStateForUser(state, 2);

    expect((exposedA.actions ?? []).length).toBe(2);
    expect((exposedB.actions ?? []).length).toBe(0);

    const choose = (actorId: number, pawnId: string) =>
      ({ type: 'choose_pawn', payload: { pawnId }, meta: { actorId } }) as any;

    state = service.applyActions(state, [choose(1, 'X')]);
    state = service.applyActions(state, [choose(2, 'O')]);

    const exposedAfterSetup: any = service.exposeStateForUser(state, 1);
    expect((exposedAfterSetup.actions ?? []).length).toBe(9);
  });

  it('detects a winner', async () => {
    const service = new MorpionService(
      { register: () => {} } as any,
      new MorpionPresenter(new GridCellActionsService()),
    );

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

    state = service.applyActions(state, [choose(1, 'X')]);
    state = service.applyActions(state, [choose(2, 'O')]);

    state = service.applyActions(state, [play(1, 0, 0)]);
    state = service.applyActions(state, [play(2, 0, 1)]);
    state = service.applyActions(state, [play(1, 1, 0)]);
    state = service.applyActions(state, [play(2, 1, 1)]);
    state = service.applyActions(state, [play(1, 2, 0)]);

    expect(String(state.status)).toBe('finished');
    expect(state.metadata.winnerId).toBe(1);
  });

  it('suggests a bot move on its turn', async () => {
    const service = new MorpionService(
      { register: () => {} } as any,
      new MorpionPresenter(new GridCellActionsService()),
    );

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

    // Finish pawn selection, then force bot turn for move suggestion.
    let next = service.applyActions(state, [choose(1, 'X')]) as any;
    next = service.applyActions(next, [choose(2, 'O')]) as any;
    next.turn.currentPlayerId = 2;

    const actions = service.getBotActions(next, 2);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0].type).toBe('morpion_play');
  });

  it('exposes ui panels for info shortcuts', async () => {
    const service = new MorpionService(
      { register: () => {} } as any,
      new MorpionPresenter(new GridCellActionsService()),
    );

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
    let configured: any = service.applyActions(state, [choose(1, 'X')]);
    configured = service.applyActions(configured, [choose(2, 'O')]);

    const exposed: any = service.exposeStateForUser(configured, 1);
    expect(exposed?.extras?.ui?.panels?.position?.message).toContain('Plateau');
    expect(exposed?.extras?.ui?.panels?.play?.message).toContain(
      'Cases libres',
    );
  });
});
