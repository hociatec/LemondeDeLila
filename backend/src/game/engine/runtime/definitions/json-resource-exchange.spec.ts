import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../../core/testing/game-test-kit';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function source(rightAmount = 3, rightResource = 'wood') {
  return {
    ...document,
    resourceIds: ['gold', 'wood'],
    setup: {
      resources: { gold: { '1': 3, '2': 0 }, wood: { '1': 0, '2': 4 } },
    },
    victory: { kind: 'score-at-least', amount: 10 },
    actions: {
      advance: {
        effects: [
          {
            kind: 'exchange-resources',
            left: { kind: 'self' },
            right: { kind: 'next' },
            leftOffer: { resource: 'gold', amount: 2 },
            rightOffer: { resource: rightResource, amount: rightAmount },
          },
          { kind: 'complete-turn' },
        ],
      },
    },
  };
}

it('executes a JSON barter and replays the exact committed state', async () => {
  const game = await testGame(compileJsonGame(manifest, source()))
    .players(2)
    .start();
  await game.as(1).do('advance', {});
  expect(game.state()).toHaveProperty('engine.playerValues.resources.gold', {
    '1': 1,
    '2': 2,
  });
  expect(game.state()).toHaveProperty('engine.playerValues.resources.wood', {
    '1': 3,
    '2': 1,
  });
  expect(await game.replay()).toEqual(game.state());
});

it('rejects an unaffordable second offer without taking the first offer', async () => {
  const game = await testGame(compileJsonGame(manifest, source(5)))
    .players(2)
    .start();
  const before = structuredClone(game.state());
  await expect(game.as(1).do('advance', {})).rejects.toThrow();
  expect(game.state()).toEqual(before);
});

it.each([
  [1, 'missing'],
  [0, 'wood'],
  [1.5, 'wood'],
] as const)(
  'validates both offer references and positive integral amounts (%s, %s)',
  (amount, resource) => {
    expect(() => compileJsonGame(manifest, source(amount, resource))).toThrow();
  },
);
