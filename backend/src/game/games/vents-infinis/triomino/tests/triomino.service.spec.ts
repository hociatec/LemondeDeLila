import { TriominoService } from '../triomino.service';
import { TriominoPresenter } from '../triomino.presenter';
import { GridCellActionsService } from '../../../../modules/grid/services/grid-cell-actions.service';
import { RandomService } from '../../../../modules/random/services/random.service';

describe('TriominoService', () => {
  it('shows turn choices for current player', async () => {
    const service = new TriominoService(
      { register: () => {} } as any,
      new RandomService(),
      new TriominoPresenter(new GridCellActionsService()),
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
    expect(exposedA.pending?.choices?.length ?? 0).toBeGreaterThan(0);
    expect(exposedB.pending).toBeNull();
  });
});
