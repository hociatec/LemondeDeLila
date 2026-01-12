import { MorpionService } from '../morpion.service';
import { MorpionPresenter } from '../morpion.presenter';
import { GridCellActionsService } from '../../../../modules/grid/services/grid-cell-actions.service';

describe('MorpionService', () => {
  it('exposes playable cells only for current player', async () => {
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

    const exposedA: any = service.exposeStateForUser(state, 1);
    const exposedB: any = service.exposeStateForUser(state, 2);

    expect((exposedA.actions ?? []).length).toBe(9);
    expect((exposedB.actions ?? []).length).toBe(0);
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

    state = service.applyActions(state, [play(1, 0, 0)]);
    state = service.applyActions(state, [play(2, 0, 1)]);
    state = service.applyActions(state, [play(1, 1, 0)]);
    state = service.applyActions(state, [play(2, 1, 1)]);
    state = service.applyActions(state, [play(1, 2, 0)]);

    expect(String(state.status)).toBe('finished');
    expect((state.metadata as any).winnerId).toBe(1);
  });
});
