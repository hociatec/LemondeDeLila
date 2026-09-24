import { cards, createCardsKitState, GameCardsController } from './cards-kit';
import type { CardLocation } from '../contracts/card-location';

function fixture() {
  const state = createCardsKitState(),
    emit = jest.fn();
  const controller = new GameCardsController(
    state,
    {
      pick: <T>(values: readonly T[]) => values[0] ?? null,
      shuffle: <T>(values: readonly T[]) => [...values],
    },
    emit,
  );
  controller.createDeck(
    cards.deck({ id: 'main', cards: ['a', 'b'], shuffle: false }),
  );
  controller.createDeck(
    cards.deck({ id: 'other', cards: ['x'], shuffle: false }),
  );
  controller.createHands(
    cards.hands({ id: 'hand', deck: 'main', initial: 0, visibility: 'owner' }),
    [1, 2],
  );
  controller.createZone(
    cards.zone({ id: 'market', deck: 'main', visibility: 'public' }),
  );
  controller.createZone(
    cards.zone({ id: 'removed', deck: 'main', visibility: 'hidden' }),
  );
  emit.mockClear();
  return { controller, state, emit };
}

it('preserves one canonical card through deck, hand, market, removed and discard zones', () => {
  const { controller } = fixture();
  const route: CardLocation[] = [
    { kind: 'deck', deckId: 'main' },
    { kind: 'hand', handId: 'hand', playerId: 1 },
    { kind: 'zone', zoneId: 'market' },
    { kind: 'zone', zoneId: 'removed' },
    { kind: 'discard', deckId: 'main' },
    { kind: 'deck', deckId: 'main' },
  ];
  for (let index = 1; index < route.length; index++) {
    expect(controller.moveCard(route[index - 1], route[index], 'a')).toBe('a');
    const all = [
      ...controller.deckCards('main'),
      ...controller.hand('hand', 1),
      ...controller.zone('market'),
      ...controller.zone('removed'),
      ...controller.discardPile('main'),
    ];
    expect(all.filter((card) => card === 'a')).toHaveLength(1);
    expect(all).toHaveLength(2);
  }
});

it('validates both ends before mutation and keeps card identities private', () => {
  const { controller, state, emit } = fixture();
  const source: CardLocation = { kind: 'deck', deckId: 'main' };
  const before = structuredClone(state);
  expect(() =>
    controller.moveCard(source, { kind: 'discard', deckId: 'other' }, 'a'),
  ).toThrow();
  expect(state).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
  controller.moveCard(
    source,
    { kind: 'hand', handId: 'hand', playerId: 1 },
    'a',
  );
  expect(emit).toHaveBeenLastCalledWith(
    'card.moved',
    {
      source,
      destination: { kind: 'hand', handId: 'hand', playerId: 1 },
    },
    { kind: 'split', privateDataByPlayer: { '1': { card: 'a' } } },
  );
});

it('does not duplicate a card or emit an event when source and destination coincide', () => {
  const { controller, state, emit } = fixture();
  const before = structuredClone(state);
  controller.moveCard(
    { kind: 'deck', deckId: 'main' },
    { kind: 'deck', deckId: 'main' },
    'a',
  );
  expect(state).toEqual(before);
  expect(emit).not.toHaveBeenCalled();
});
