import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../../core/testing/game-test-kit';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function definition(effect: unknown, initial = 1) {
  return compileJsonGame(manifest, {
    ...document,
    setup: { firstPlayer: 'first' },
    components: [
      {
        component: 'cards.deck',
        id: 'deck',
        cards: [{ id: 'a' }, { id: 'b' }],
        shuffle: false,
      },
      {
        component: 'cards.hands',
        id: 'hand',
        deck: 'deck',
        initial,
        visibility: 'owner',
      },
    ],
    actions: { advance: { effects: [effect] } },
  });
}

const exchange = {
  kind: 'exchange-random-cards',
  handId: 'hand',
  left: { kind: 'self' },
  right: { kind: 'next' },
};

it('exchanges identified cards through JSON and preserves deterministic replay', async () => {
  const game = await testGame(definition(exchange))
    .players(['One', 'Two'])
    .seed(42)
    .start();
  const left = game.inspect.hand(1, 'hand');
  const right = game.inspect.hand(2, 'hand');
  await game.as(1).do('advance', {});
  expect(game.inspect.hand(1, 'hand')).toEqual(right);
  expect(game.inspect.hand(2, 'hand')).toEqual(left);
  expect(await game.replay()).toEqual(game.state());
});

it('keeps self exchanges and empty hands unchanged', async () => {
  for (const [effect, initial] of [
    [{ ...exchange, right: { kind: 'self' } }, 1],
    [exchange, 0],
  ] as const) {
    const game = await testGame(definition(effect, initial))
      .players(['One', 'Two'])
      .seed(42)
      .start();
    const hands = [game.inspect.hand(1, 'hand'), game.inspect.hand(2, 'hand')];
    await game.as(1).do('advance', {});
    expect([
      game.inspect.hand(1, 'hand'),
      game.inspect.hand(2, 'hand'),
    ]).toEqual(hands);
    expect(await game.replay()).toEqual(game.state());
  }
});

it.each([
  { ...exchange, handId: 'missing' },
  { ...exchange, left: { kind: 'expression', value: 'players[0]' } },
  { ...exchange, count: 2 },
])(
  'rejects invalid exchange references and grammar before starting',
  (effect) => {
    expect(() => definition(effect)).toThrow();
  },
);
