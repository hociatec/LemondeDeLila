import { withDicePresentation } from './dice-presenter.helper';

describe('withDicePresentation', () => {
  it('associe le de a l action de lancer sans exposer son nom au client', () => {
    const state = withDicePresentation({
      lastRoll: 4,
      turnIndex: 7,
      actions: [
        { type: 'inspect', payload: {} },
        { type: 'roll_dice', payload: {} },
      ],
      extras: {},
    });

    expect((state.extras as any).dice).toEqual({
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
      lastRoll: 8,
      turnIndex: 2,
      actions: [],
      extras: { dice: { dice, total: 8, rollKey: 'round-2-roll-1' } },
    });

    expect((state.extras as any).dice.dice).toEqual(dice);
    expect((state.extras as any).dice.rollKey).toBe('round-2-roll-1');
  });
});
