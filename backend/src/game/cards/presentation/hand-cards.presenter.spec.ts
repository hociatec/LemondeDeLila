import { bindHandCardActions } from './hand-cards.presenter';

describe('bindHandCardActions', () => {
  it('associe chaque exemplaire de carte a une action distincte', () => {
    const cards = [
      { id: '1', label: '1' },
      { id: '1', label: '1' },
      { id: '2', label: '2' },
    ];
    const actions = [
      { type: 'inspect', payload: {} },
      { type: 'play', payload: { value: 1 } },
      { type: 'play', payload: { value: 1 } },
    ];

    expect(
      bindHandCardActions(cards, actions, {
        actionTypes: ['play'],
        disableUnbound: true,
      }),
    ).toEqual([
      { id: '1', label: '1', actionIndex: 1 },
      { id: '1', label: '1', actionIndex: 2 },
      { id: '2', label: '2', disabled: true },
    ]);
  });
});
