import { withDicePresentation } from './dice.presenter';

describe('withDicePresentation', () => {
  it('associe le de a l action de lancer sans exposer son nom au client', () => {
    const state = withDicePresentation({
      system: { turn: { number: 7 } },
      actions: [
        { type: 'inspect', payload: {} },
        { type: 'roll', payload: {} },
      ],
      kits: { dice: { total: 4 } },
    });

    expect((state.kits as any).dice).toEqual({
      label: 'Dés',
      total: 4,
      rollActionIndex: 1,
      rollKey: '7:4',
      dice: [{ id: 'main', label: 'Dé', sides: 6, actionIndex: 1 }],
    });
  });

  it('conserve les des multiples fournis par un jeu', () => {
    const dice = [
      { id: 'red', label: 'Dé rouge', sides: 8, value: 3 },
      { id: 'blue', label: 'Dé bleu', sides: 8, value: 5 },
    ];
    const state = withDicePresentation({
      system: { turn: { number: 2 } },
      actions: [],
      kits: { dice: { dice, total: 8, rollKey: 'round-2-roll-1' } },
    });

    expect((state.kits as any).dice.dice).toEqual(dice);
    expect((state.kits as any).dice.rollKey).toBe('round-2-roll-1');
  });
});
