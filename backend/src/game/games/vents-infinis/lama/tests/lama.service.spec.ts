import { LamaService } from '../lama.service';
import { LamaPresenter } from '../lama.presenter';
import { RandomService } from '../../../../modules/random/services/random.service';

describe('LamaService', () => {
  it('exposes pending choices only for current player', async () => {
    const service = new LamaService(
      { register: () => {} } as any,
      new RandomService(),
      new LamaPresenter(),
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
