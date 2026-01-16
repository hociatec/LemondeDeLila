import * as Rulebook from '../rulebook/rulebook';

describe('FouleesFantastiques scenario', () => {
  it('offers roll when nothing pending', () => {
    const state: any = {
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'A' }],
    };

    const actions = Rulebook.getAvailableActions(state, 1);
    expect(actions.map((a: any) => a.type)).toContain('roll');
  });

  it('canonicalizes legacy ROLL_DICE action', () => {
    const state: any = {
      status: 'started',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'A' }],
    };

    const validated = Rulebook.validateAction(
      state,
      { type: 'ROLL_DICE', payload: { anything: true } } as any,
      1,
    );
    expect(validated).toEqual({ type: 'roll', payload: {} });
  });
});
