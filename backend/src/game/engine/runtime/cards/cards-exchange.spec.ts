import {
  cards,
  createCardsKitState,
  GameCardsController,
  type CardValue,
} from './cards-kit';

function fixture<T extends CardValue>(values: readonly T[]) {
  const state = createCardsKitState();
  const deck = cards.deck({ id: 'main', cards: values });
  const hands = cards.hands({
    id: 'hands',
    deck: 'main',
    initial: 0,
    visibility: 'owner',
  });
  const controller = new GameCardsController(
    state,
    {
      pick: <T>(choices: readonly T[]) => choices[0] ?? null,
      shuffle: <T>(choices: readonly T[]) => [...choices],
    },
    undefined,
    [deck, hands],
  );
  controller.createDeck(deck);
  controller.createHands(hands, [1, 2]);
  controller.drawToHand('main', 'hands', 1);
  controller.drawToHand('main', 'hands', 2);
  return { state, controller };
}

it('exchanges catalog objects using their persistent identity', () => {
  const { state, controller } = fixture([
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ]);
  const first = controller.hand('hands', 1);
  const second = controller.hand('hands', 2);
  controller.exchangeRandom('hands', 1, 2);
  expect(controller.hand('hands', 1)).toEqual(second);
  expect(controller.hand('hands', 2)).toEqual(first);
  expect(state.hands.hands).toEqual({ '1': ['b'], '2': ['a'] });
});

it('exchanges numeric card zero instead of treating it as an empty hand', () => {
  const { controller } = fixture([0, 1]);
  controller.exchangeRandom('hands', 1, 2);
  expect(controller.hand('hands', 1)).toEqual([1]);
  expect(controller.hand('hands', 2)).toEqual([0]);
});

it('materializes collection content without exposing the immutable catalogue', () => {
  const { controller, state } = fixture([
    { id: 'a', values: new Map([['power', 2]]) },
    { id: 'b', values: new Map([['power', 3]]) },
  ]);
  const [card] = controller.hand<{ id: string; values: Map<string, number> }>(
    'hands',
    1,
  );
  expect(card.values.get('power')).toBe(2);
  card.values.set('power', 99);
  const [again] = controller.hand<typeof card>('hands', 1);
  expect(again.values.get('power')).toBe(2);
  expect(state.hands.hands['1']).toEqual(['a']);
});

it('can take a structurally equal object card without an identifier', () => {
  const { controller } = fixture([{ value: 'a' }, { value: 'b' }]);
  const card = controller.hand('hands', 1)[0];
  expect(controller.take('hands', 1, structuredClone(card))).toEqual(card);
  expect(controller.hand('hands', 1)).toEqual([]);
});

it('refuses a missing exchange card without removing either owned card', () => {
  const { state, controller } = fixture(['a', 'b']);
  const before = structuredClone(state);
  expect(() => controller.exchange('hands', 1, 'a', 2, 'missing')).toThrow();
  expect(state).toEqual(before);
});

it('keeps a self exchange atomic and unchanged', () => {
  const { state, controller } = fixture(['a', 'b']);
  const before = structuredClone(state);
  controller.exchange('hands', 1, 'a', 1, 'a');
  expect(state).toEqual(before);
});
