import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

function compile(acceptedDecks: string[], secondaryCard = 'b') {
  return compileJsonGame(manifest, {
    ...document,
    setup: { firstPlayer: 'first' },
    components: [
      {
        component: 'cards.deck',
        id: 'primary',
        cards: ['a'],
        catalog: ['a', 'b'],
      },
      { component: 'cards.deck', id: 'secondary', cards: [secondaryCard] },
      {
        component: 'cards.hands',
        id: 'hand',
        deck: 'primary',
        acceptedDecks,
        initial: 0,
        visibility: 'owner',
      },
    ],
    phases: { playing: { actions: ['advance'], terminal: true } },
    actions: {
      advance: {
        effects: [
          { kind: 'draw-cards', deckId: 'secondary', handId: 'hand', count: 1 },
          {
            kind: 'discard-random',
            deckId: 'secondary',
            handId: 'hand',
            count: 1,
          },
        ],
      },
    },
  });
}

it('validates explicit shared hand source and discard references before startup', () => {
  expect(() => compile(['secondary'])).not.toThrow();
});

it.each([[], ['missing'], ['secondary', 'secondary']])(
  'rejects invalid accepted decks %j',
  (...accepted) => {
    expect(() => compile(accepted)).toThrow();
  },
);

it('rejects a secondary catalog outside the canonical hand catalog', () => {
  expect(() => compile(['secondary'], 'outside')).toThrow();
});
