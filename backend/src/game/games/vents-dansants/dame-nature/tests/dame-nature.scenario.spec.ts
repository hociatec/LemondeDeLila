import { DameNatureService } from '../dame-nature.service';
import { createDameNatureTestingModule } from './dame-nature-test-harness';

describe('DameNature scenario (smoke)', () => {
  it('plays multiple actions without crashing', async () => {
    const moduleRef = await createDameNatureTestingModule();
    const game = moduleRef.get(DameNatureService);

    let state: any = game.hydrateInitialState({
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      status: 'started',
    } as any);
    state.status = 'started';
    state.turn = { currentPlayerId: 1, direction: 1 };
    state.turnIndex = 0;

    for (let i = 0; i < 25; i++) {
      const currentId = state.turn?.currentPlayerId ?? null;
      if (typeof currentId !== 'number') break;
      const actions = game.getAvailableActions(state, currentId);
      if (!actions.length) break;
      state = game.applyActions(state, [actions[0]]);
      if ((state.status || '').toLowerCase() === 'finished') break;
    }

    expect(Array.isArray(state.players)).toBe(true);
  });
});
