import { cards, createCardsKitState, GameCardsController } from './cards-kit';

function fixture(acceptedDecks: string[] = ['secondary']) {
  const primary = cards.deck({
    id: 'primary',
    cards: ['a'],
    catalog: ['a', 'b'],
  });
  const secondary = cards.deck({ id: 'secondary', cards: ['b'] });
  const outside = cards.deck({ id: 'outside', cards: ['c'] });
  const hand = cards.hands({
    id: 'hand',
    deck: 'primary',
    acceptedDecks,
    initial: 0,
    visibility: 'owner',
  });
  const state = createCardsKitState();
  const controller = new GameCardsController(
    state,
    {
      pick: <T>(values: readonly T[]) => values[0] ?? null,
      shuffle: <T>(values: readonly T[]) => [...values],
    },
    undefined,
    [primary, secondary, outside, hand],
  );
  for (const deck of [primary, secondary, outside]) controller.createDeck(deck);
  controller.createHands(hand, [1]);
  return { controller, state };
}

it('draws and discards through an explicitly accepted compatible deck', () => {
  const { controller, state } = fixture();
  expect(controller.drawToHand('secondary', 'hand', 1)).toBe('b');
  expect(controller.hand('hand', 1)).toEqual(['b']);
  controller.play('hand', 'secondary', 1, 'b');
  expect(controller.hand('hand', 1)).toEqual([]);
  expect(state.discards.secondary).toEqual(['b']);
  const before = structuredClone(state);
  expect(() => controller.drawToHand('outside', 'hand', 1)).toThrow();
  expect(state).toEqual(before);
});

it.each([['missing'], ['outside'], ['secondary', 'secondary']])(
  'rejects unknown, incompatible or duplicated accepted decks: %j',
  (...accepted) => {
    expect(() => fixture(accepted)).toThrow();
  },
);
