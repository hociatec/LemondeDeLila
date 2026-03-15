import { getAvailableActions } from './rulebook';

describe('galopons rulebook', () => {
  it('exposes a single roll action for the current player', () => {
    const state: any = {
      status: 'started',
      players: [
        { id: 1, username: 'P1' },
        { id: 2, username: 'P2' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      pending: null,
    };

    expect(getAvailableActions(state, 1)).toEqual([{ type: 'roll' }]);
    expect(getAvailableActions(state, 2)).toEqual([]);
  });
});
