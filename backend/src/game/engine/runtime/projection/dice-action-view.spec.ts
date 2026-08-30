import { projectDiceActionView } from './dice-action-view';

describe('projectDiceActionView', () => {
  it('associe le dé à l’action de lancer', () => {
    const state = projectDiceActionView({
      system: { turn: { number: 7 } },
      actions: [
        { type: 'inspect', payload: {} },
        { type: 'roll', payload: {} },
      ],
      kits: { dice: { total: 4 } },
    });

    expect(state.kits.dice).toEqual({
      label: 'Dés',
      total: 4,
      rollActionIndex: 1,
      rollKey: '7:4',
      dice: [{ id: 'main', label: 'Dé', sides: 6, actionIndex: 1 }],
    });
  });

  it('conserve les dés multiples fournis par un jeu', () => {
    const dice = [
      { id: 'red', label: 'Dé rouge', sides: 8, value: 3 },
      { id: 'blue', label: 'Dé bleu', sides: 8, value: 5 },
    ];
    const state = projectDiceActionView({
      system: { turn: { number: 2 } },
      actions: [],
      kits: { dice: { dice, total: 8, rollKey: 'round-2-roll-1' } },
    });

    expect((state.kits.dice as { dice: unknown }).dice).toEqual(dice);
    expect((state.kits.dice as { rollKey: string }).rollKey).toBe(
      'round-2-roll-1',
    );
  });
});
