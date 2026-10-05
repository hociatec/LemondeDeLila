import { createPlayerValuesKitState } from '../kits/player-values-kit';
import { projectPlayerValues } from './player-values-projection';

describe('player values projection', () => {
  it('publishes a zero score for every player even without explicit scoring initialization', () => {
    const view = projectPlayerValues(
      createPlayerValuesKitState(),
      1,
      {},
      [1, 2],
    );

    expect(view.scoring).toEqual({
      byPlayer: { '1': 0, '2': 0 },
      leaderboard: [
        { playerId: 1, score: 0, rank: 1 },
        { playerId: 2, score: 0, rank: 1 },
      ],
    });
  });

  it('does not reveal scores hidden by the game', () => {
    const state = createPlayerValuesKitState();
    state.scores['1'] = 8;

    const view = projectPlayerValues(
      state,
      1,
      { scores: { kind: 'hidden' } },
      [1, 2],
    );

    expect(view.scoring).toEqual({ byPlayer: {}, leaderboard: [] });
  });

  it('publishes zero for visible resources that have not been initialized', () => {
    const state = createPlayerValuesKitState();
    state.resources.apple = {};

    expect(projectPlayerValues(state, 1, {}, [1, 2]).resources.apple).toEqual({
      '1': 0,
      '2': 0,
    });
  });

  it('completes a private resource only for its viewer', () => {
    const state = createPlayerValuesKitState();
    state.resources.secret = {};

    expect(
      projectPlayerValues(
        state,
        2,
        { resources: { secret: { kind: 'private-by-player' } } },
        [1, 2],
      ).resources.secret,
    ).toEqual({ '2': 0 });
  });
});
