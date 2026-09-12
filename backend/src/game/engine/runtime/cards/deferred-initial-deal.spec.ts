import { cards, createCardsKitState, GameCardsController } from './cards-kit';

function fixture(values: string[], deferred: string[], count = 2) {
  const state = createCardsKitState();
  const deck = cards.deck({ id: 'main', cards: values });
  const hand = cards.hands({
    id: 'hands',
    deck: 'main',
    initial: count,
    initialDeferredCardIds: deferred,
    visibility: 'owner',
  });
  const controller = new GameCardsController(
    state,
    {
      pick: <T>(items: readonly T[]) => items[0] ?? null,
      shuffle: <T>(items: readonly T[]) => [...items],
    },
    undefined,
    [deck, hand],
  );
  controller.createDeck(deck);
  controller.createHands(hand, [1, -2]);
  return { controller, state };
}

it('distributes round robin and restores skipped cards in draw order', () => {
  const { controller } = fixture(
    ['s1', 'a', 's2', 'b', 'c', 'd', 'e'],
    ['s1', 's2'],
  );
  expect(controller.hand('hands', 1)).toEqual(['a', 'c']);
  expect(controller.hand('hands', -2)).toEqual(['b', 'd']);
  expect(controller.draw('main')).toBe('s1');
  expect(controller.draw('main')).toBe('s2');
  expect(controller.draw('main')).toBe('e');
});

it('terminates when the pile contains only deferred cards', () => {
  const { controller } = fixture(['s1', 's2'], ['s1', 's2']);
  expect(controller.hand('hands', 1)).toEqual([]);
  expect(controller.hand('hands', -2)).toEqual([]);
  expect(controller.draw('main')).toBe('s1');
  expect(controller.draw('main')).toBe('s2');
});

it('retains partial distribution when ordinary cards run out', () => {
  const { controller } = fixture(['s1', 'a', 'b', 's2', 'c'], ['s1', 's2']);
  expect(controller.hand('hands', 1)).toEqual(['a', 'c']);
  expect(controller.hand('hands', -2)).toEqual(['b']);
  expect(controller.deckCount('main')).toBe(2);
});

it.each([['unknown'], ['a', 'a']].map((deferred) => ({ deferred })))(
  'rejects invalid deferred catalog references %j',
  ({ deferred }) => {
    expect(() => fixture(['a', 'b'], deferred)).toThrow();
  },
);

it('does not freeze the author-owned configuration array', () => {
  const deferred = ['s1'];
  fixture(['s1', 'a'], deferred, 0);
  expect(() => deferred.push('s2')).not.toThrow();
});
