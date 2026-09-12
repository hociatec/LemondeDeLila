import {
  cards,
  createCardsKitState,
  GameCardsController,
  type CardValue,
} from './cards-kit';
import {
  GameStateViolationError,
  GameRuleViolationError,
} from '../../../core/domain/errors/game-domain.errors';

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

it.each([
  { hands: { hands: { '01': [] } } },
  { hands: { hands: { '0': [] } } },
  { hands: { hands: { '1': {} } } },
  { decks: { main: {} } },
  { zones: [] },
  { deckLifecycles: { main: { empty: 'invented', exhausted: false } } },
  { deckLifecycles: { main: { empty: 'exhaust', exhausted: 1 } } },
  { discards: { other: [] } },
  { discards: {} },
  { deckLifecycles: {} },
  { completedSets: { families: { '1': ['set', 'set'] } } },
])(
  'rejects malformed persisted card containers before normalization: %j',
  (patch) => {
    const { state } = fixture(['a', 'b']);
    Object.assign(state, patch);
    const before = structuredClone(state);
    expect(
      () =>
        new GameCardsController(state, {
          pick: <T>(values: readonly T[]) => values[0] ?? null,
          shuffle: <T>(values: readonly T[]) => [...values],
        }),
    ).toThrow(GameStateViolationError);
    expect(state).toEqual(before);
  },
);

it('keeps collection reads detached and validates completed families', () => {
  const { state, controller } = fixture(['a', 'b']);
  controller.createSets(
    cards.sets({
      id: 'families',
      hand: 'hands',
      deck: 'main',
      sets: { first: ['a'] },
    }),
    [1, 2],
  );
  const before = structuredClone(state);
  controller.playerCompletedSets('families', 9).push('invented');
  expect(state).toEqual(before);
  expect(controller.completeSet('families', 1, 'first')).toBe(true);
  expect(controller.playerCompletedSets('families', 1)).toEqual(['first']);
  expect(() => controller.assertValid()).not.toThrow();
  state.completedSets.families['1'].push('invented');
  expect(() => controller.assertValid()).toThrow(GameStateViolationError);
});

it('counts physical copies before consuming a family', () => {
  const { state, controller } = fixture(['a', 'b']);
  controller.createSets(
    cards.sets({
      id: 'twins',
      hand: 'hands',
      deck: 'main',
      sets: { pair: ['a', 'a'] },
    }),
    [1, 2],
  );
  const before = structuredClone(state);
  expect(controller.completeSet('twins', 1, 'pair')).toBe(false);
  expect(state).toEqual(before);
  expect(
    controller.completeSet('twins', 1, 'pair', { allowIncomplete: true }),
  ).toBe(true);
  expect(controller.hand('hands', 1)).toEqual([]);
  expect(controller.playerCompletedSets('twins', 1)).toEqual(['pair']);
});

it('rejects a foreign deck even with well-formed lifecycle and discard', () => {
  const { state, controller } = fixture(['a', 'b']);
  state.decks.unknown = [];
  state.discards.unknown = [];
  state.deckLifecycles.unknown = { empty: 'exhaust', exhausted: false };
  expect(() => controller.assertValid()).toThrow(GameStateViolationError);
});

it('never destroys a nonempty deck when recycling its discard', () => {
  const { state, controller } = fixture(['a', 'b', 'c']);
  controller.discardFromHand('hands', 'main', 1, 'a');
  const before = structuredClone(state);
  expect(() => controller.recycle('main')).toThrow(GameRuleViolationError);
  expect(state).toEqual(before);
  expect(controller.draw('main')).toBe('c');
  controller.recycle('main');
  expect(controller.draw('main')).toBe('a');
});

it.each([
  [1, 1],
  [1, 0],
  [1, NaN],
])(
  'rejects malformed recipients before clearing existing hands: %j',
  (...players) => {
    const { state, controller } = fixture(['a', 'b']);
    const before = structuredClone(state);
    expect(() => controller.clearHands('hands', players)).toThrow();
    expect(state).toEqual(before);
  },
);

it.each(['hands', 'zones', 'completedSets'] as const)(
  'rejects an unregistered persisted %s component',
  (kind) => {
    const { state, controller } = fixture(['a', 'b']);
    Object.assign(state[kind], { unknown: kind === 'zones' ? [] : {} });
    expect(() => controller.assertValid()).toThrow(GameStateViolationError);
  },
);

it.each(['draw', 'play', 'discard'] as const)(
  'rejects a mismatched hand/deck before %s mutates cards',
  (operation) => {
    const { state, controller } = fixture(['a', 'b']);
    controller.createDeck(cards.deck({ id: 'other', cards: ['a', 'b'] }));
    const before = structuredClone(state);
    expect(() => {
      if (operation === 'draw') controller.drawToHand('other', 'hands', 1);
      else if (operation === 'play') controller.play('hands', 'other', 1, 'a');
      else controller.discardFromHand('hands', 'other', 1, 'a');
    }).toThrow();
    expect(state).toEqual(before);
  },
);

it.each([-1, 0.5, NaN, Infinity, 100001])(
  'rejects invalid draw/deal quantity %s before moving cards',
  (count) => {
    const { state, controller } = fixture(['a', 'b', 'c']);
    const before = structuredClone(state);
    expect(() =>
      controller.drawManyToHand('main', 'hands', 1, count),
    ).toThrow();
    expect(() => controller.deal('main', 'hands', [1, 2], count)).toThrow();
    expect(state).toEqual(before);
  },
);

it('validates all recipients before dealing or transferring', () => {
  const { state, controller } = fixture(['a', 'b', 'c']);
  const before = structuredClone(state);
  expect(() => controller.deal('main', 'hands', [1, 0], 1)).toThrow();
  expect(() => controller.deal('main', 'hands', [1, 1], 1)).toThrow();
  expect(() => controller.transfer('hands', 1, 0, 'a')).toThrow();
  expect(() => controller.shuffleHands('hands', [1, 1])).toThrow();
  expect(() => controller.swapHands('missing', 1, 2)).toThrow();
  expect(() => controller.swapHands('hands', 1, 0)).toThrow();
  expect(() => controller.draw('missing')).toThrow();
  expect(() => controller.discard('missing', 'a')).toThrow();
  expect(() => controller.putOnTop('missing', ['a'])).toThrow();
  expect(state).toEqual(before);
});

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

it('rejects an unknown primitive card without adding it to a hand', () => {
  const { state, controller } = fixture(['a', 'b']);
  const before = structuredClone(state);
  expect(() => controller.give('hands', 1, 'invented')).toThrow();
  expect(state).toEqual(before);
});

it('accepts later cards only from an explicit catalog without changing the initial draw pile', () => {
  const state = createCardsKitState();
  const deck = cards.deck({ id: 'deck', cards: ['a'], catalog: ['a', 'b'] });
  const hands = cards.hands({
    id: 'hand',
    deck: 'deck',
    initial: 0,
    visibility: 'owner',
  });
  const controller = new GameCardsController(
    state,
    {
      pick: <T>(values: readonly T[]) => values[0] ?? null,
      shuffle: <T>(values: readonly T[]) => [...values],
    },
    undefined,
    [deck, hands],
  );
  controller.createDeck(deck);
  controller.createHands(hands, [1]);
  expect(state.decks.deck).toEqual(['a']);
  controller.give('hand', 1, 'b');
  expect(controller.hand('hand', 1)).toEqual(['b']);
  expect(() =>
    cards.deck({ id: 'bad', cards: ['b'], catalog: ['a'] }),
  ).toThrow();
});
