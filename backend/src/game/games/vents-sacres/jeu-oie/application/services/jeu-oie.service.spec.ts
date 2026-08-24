import * as Rulebook from '../../rulebook/rulebook';

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

  it('offers choose_pawn only when selection is pending', () => {
    const state: any = {
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      pending: {
        type: 'choose_pawn',
        playerId: 2,
        data: { pawns: [{ id: 'coq-rockeur' }, { id: 'vache-artistique' }] },
      },
      metadata: {},
    };

    const actionsA = Rulebook.getAvailableActions(state, 1);
    const actionsB = Rulebook.getAvailableActions(state, 2);

    expect(actionsA.length).toBe(0);
    expect(actionsB.every((a: any) => a.type === 'choose_pawn')).toBe(true);
  });
});

