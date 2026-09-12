import { defineAction } from './game-definition-builders';
import { defineGame } from './game-definition';
import { gameInput } from '../actions/game-input-schema';
import { defineGameContent } from '../content/game-content';
import { cards } from '../cards/cards-kit';
import { grid } from '../kits/grid-kit';
import { gameEffects } from '../effects/effects-kit';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { assertStaticEffectReferences } from './static-effect-references';

const base = {
  id: 'reference-test',
  displayName: 'References',
  category: 'test',
  players: { min: 1, max: 2 },
  actions: {
    wait: defineAction({ input: gameInput.object({}), execute: () => {} }),
  },
};

it('rejects unknown effects in catalogues that are not installed as decks', () => {
  for (const effectId of ['missing', 'constructor', 'toString']) {
    expect(() =>
      defineGame<object>()({
        ...base,
        content: defineGameContent(base.id, {
          unusedCards: [{ id: 'x', effects: [gameEffects.custom(effectId)] }],
        }),
      }),
    ).toThrow(GameConfigurationError);
  }
});

it('validates effect references in Map keys and values and Set entries', () => {
  const invalid = { effects: [gameEffects.custom('missing')] };
  for (const catalogue of [
    new Map([[invalid, 'value']]),
    new Map([['key', invalid]]),
    new Set([invalid]),
  ]) {
    expect(() =>
      assertStaticEffectReferences(
        catalogue,
        'content.catalogue',
        {
          decks: new Map(),
          hands: new Map(),
          inventories: new Map(),
          tracks: new Set(),
          diceSets: new Set(),
        },
        (path, message) => {
          throw new Error(`${path}: ${message}`);
        },
      ),
    ).toThrow(/missing/);
  }
});

it('rejects noncanonical component ids and missing initialization references', () => {
  for (const id of [' padded ', 'bad/id', '__proto__', 'constructor']) {
    expect(() =>
      defineGame<object>()({
        ...base,
        components: [cards.deck({ id, cards: ['one'] })],
      }),
    ).toThrow(GameConfigurationError);
  }
  expect(() =>
    defineGame<object>()({
      ...base,
      initialization: { tracks: { absent: 0 } },
    }),
  ).toThrow(GameConfigurationError);
  expect(() =>
    defineGame<object>()({
      ...base,
      initialization: { pawns: [{ setId: 'absent' }] },
    }),
  ).toThrow(GameConfigurationError);
});

it('validates declarative deals and grid placements before setup', () => {
  const deck = cards.deck({ id: 'deck', cards: ['one'] });
  const hand = cards.hands({
    id: 'hand',
    deck: 'deck',
    initial: 0,
    visibility: 'owner',
  });
  const board = grid.board({ id: 'board', width: 2, height: 2 });
  expect(() =>
    defineGame<object>()({
      ...base,
      components: [deck, hand, board],
      initialization: {
        deals: [{ deckId: 'missing', handId: 'hand', count: 1 }],
      },
    }),
  ).toThrow(GameConfigurationError);
  expect(() =>
    defineGame<object>()({
      ...base,
      components: [deck, hand, board],
      initialization: {
        gridPlacements: [{ boardId: 'board', positions: [{ x: 2, y: 0 }] }],
      },
    }),
  ).toThrow(GameConfigurationError);
});
