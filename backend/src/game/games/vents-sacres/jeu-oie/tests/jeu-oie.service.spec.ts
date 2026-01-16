import * as Rulebook from '../rulebook/rulebook';

describe('JeuOieService', () => {
  it('offers roll only for current player', () => {
    const state: any = {
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      metadata: {},
    };

    const actionsA = Rulebook.getAvailableActions(state, 1);
    const actionsB = Rulebook.getAvailableActions(state, 2);

    expect(actionsA.some((a: any) => a.type === 'roll')).toBe(true);
    expect(actionsB.some((a: any) => a.type === 'roll')).toBe(false);
  });
});
