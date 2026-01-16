import * as Rulebook from '../rulebook/rulebook';

describe('FouleesFantastiquesService', () => {
  it('starts with family choice, then enables roll', async () => {
    const state: any = {
      status: 'started',
      phase: 'setup',
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      pending: {
        type: 'choose_family',
        playerId: 1,
        data: { familyIds: ['equides', 'oiseaux'] },
      },
      metadata: { familyIdByPlayer: { 2: 'equides' } },
    };

    const actions = Rulebook.getAvailableActions(state, 1);
    expect(actions.map((a: any) => a.type)).toContain('choose_family');

    expect(() =>
      Rulebook.validateAction(
        state,
        { type: 'choose_family', payload: { familyId: 'equides' } } as any,
        1,
      ),
    ).toThrow();

    const validated = Rulebook.validateAction(
      state,
      { type: 'choose_family', payload: { familyId: 'oiseaux' } } as any,
      1,
    );
    expect(validated.type).toBe('choose_family');
    expect(validated.payload.familyId).toBe('oiseaux');
  });
});
