import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../fixtures/json-course/manifest.json';
import document from '../../fixtures/json-course/game.json';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';

const question = {
  id: 'q',
  prompt: 'Question',
  choices: ['a', 'b'],
  answerIndex: 0,
};
const cases: readonly (readonly [object, string, unknown])[] = [
  [{ component: 'dice.set', id: 'dice', count: 101, sides: 6 }, 'count', 101],
  [
    { component: 'dice.set', id: 'dice', count: 1, sides: 1_000_001 },
    'sides',
    1_000_001,
  ],
  [
    { component: 'movement.track', id: 'track', spaces: 1_000_001 },
    'spaces',
    1_000_001,
  ],
  [
    {
      component: 'movement.track',
      id: 'track',
      spaces: 5,
      landingEffects: { '7': [] },
    },
    'landingEffects.7',
    [],
  ],
  [
    { component: 'inventory.set', id: 'inventory', items: ['a', 'a'] },
    'items[1]',
    'a',
  ],
  [
    { component: 'ownership.registry', id: 'ownership', assets: ['a', 'a'] },
    'assets[1]',
    'a',
  ],
  [
    {
      component: 'pawn.set',
      id: 'pawns',
      perPlayer: 1,
      pawns: [{ id: 'a' }, { id: 'a' }],
    },
    'pawns[1].id',
    'a',
  ],
  [
    { component: 'pawn.set', id: 'pawns', perPlayer: 2, pawns: [{ id: 'a' }] },
    'perPlayer',
    2,
  ],
  [
    { component: 'quiz.bank', id: 'quiz', questions: [question, question] },
    'questions[1].id',
    'q',
  ],
  [
    {
      component: 'quiz.bank',
      id: 'quiz',
      questions: [{ ...question, answerIndex: 2 }],
    },
    'questions[0].answerIndex',
    2,
  ],
  [
    { component: 'cards.deck', id: 'extra', cards: [{ id: 'a' }, { id: 'a' }] },
    'cards[1].id',
    'a',
  ],
  [
    {
      component: 'cards.deck',
      id: 'extra',
      cards: [{ id: 'a' }],
      catalog: [{ id: 'a' }, { id: 'a' }],
    },
    'catalog[1].id',
    'a',
  ],
  [
    {
      component: 'cards.deck',
      id: 'extra',
      cards: ['a', 'missing'],
      catalog: ['a'],
    },
    'cards[1]',
    'missing',
  ],
  [
    { component: 'cards.deck', id: 'extra', cards: [{ id: 'a' }, 'b'] },
    'cards[1]',
    'b',
  ],
  [
    {
      component: 'cards.deck',
      id: 'extra',
      cards: ['a'],
      catalog: ['a', { id: 'b' }],
    },
    'catalog[1]',
    { id: 'b' },
  ],
];

function diagnostic(source: unknown, path: string, received: unknown): void {
  let caught: unknown;
  try {
    compileJsonGame(manifest, source);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(AuthoringError);
  expect(caught).toMatchObject({ path, received });
  expect(authoringValueAt(source, path.slice('game.json.'.length))).toEqual(
    received,
  );
}

it.each(cases)(
  'locates component factory errors %#',
  (component, field, received) => {
    diagnostic(
      { ...document, components: [...document.components, component] },
      `game.json.components[3].${field}`,
      received,
    );
  },
);

it.each([
  [
    { initialDeferredCardIds: ['a', 'missing'] },
    'initialDeferredCardIds[1]',
    'missing',
  ],
  [{ initialDeferredCardIds: ['a', 'a'] }, 'initialDeferredCardIds[1]', 'a'],
  [{ acceptedDecks: ['deck', 'deck'] }, 'acceptedDecks[1]', 'deck'],
  [{ acceptedDecks: ['missing'] }, 'acceptedDecks[0]', 'missing'],
  [{ acceptedDecks: ['incompatible'] }, 'acceptedDecks[0]', 'incompatible'],
] as const)(
  'locates hand/deck compatibility errors %#',
  (fields, field, received) => {
    diagnostic(
      {
        ...document,
        components: [
          document.components[0],
          { ...document.components[1], ...fields },
          document.components[2],
          { component: 'cards.deck', id: 'incompatible', cards: ['x'] },
        ],
      },
      `game.json.components[1].${field}`,
      received,
    );
  },
);
