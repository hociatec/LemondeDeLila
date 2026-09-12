import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function compile(deferred: unknown) {
  return compileJsonGame(manifest, {
    ...document,
    components: [
      ...document.components,
      {
        component: 'cards.deck',
        id: 'filtered-deck',
        cards: ['normal', 'special'],
      },
      {
        component: 'cards.hands',
        id: 'filtered-hand',
        deck: 'filtered-deck',
        initial: 1,
        visibility: 'owner',
        initialDeferredCardIds: deferred,
      },
    ],
  });
}

it('accepts a declarative initial dealing exclusion from the deck catalog', () => {
  expect(() => compile(['special'])).not.toThrow();
});

it.each([
  { deferred: ['unknown'] },
  { deferred: ['special', 'special'] },
  { deferred: [null] },
  { deferred: [Infinity] },
  { deferred: 'special' },
])(
  'rejects invalid deferred cards before startup: $deferred',
  ({ deferred }) => {
    expect(() => compile(deferred)).toThrow();
  },
);
