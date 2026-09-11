import { defineGame } from './game-definition';
import { defineAction } from './game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameComponentDefinition } from './component-kit';
import { pawns } from '../kits/pawn-kit';

function compile(components: readonly GameComponentDefinition[]) {
  return defineGame<object>()({
    id: 'catalog-validation',
    displayName: 'Catalog validation',
    category: 'test',
    players: { min: 1, max: 2 },
    actions: {
      pass: defineAction({ input: gameInput.object({}), execute: () => {} }),
    },
    components,
  });
}

it.each<GameComponentDefinition>([
  { component: 'cards.deck', id: 'deck', cards: [{ id: 'a' }, { id: 'a' }] },
  { component: 'cards.deck', id: 'deck', cards: [{ id: 'a' }, 'a'] },
  { component: 'dice.set', id: 'dice', count: 0, sides: 6 },
  { component: 'dice.set', id: 'dice', count: 1, sides: 1.5 },
  { component: 'grid.board', id: 'board', width: 0, height: 3 },
  { component: 'movement.track', id: 'track', spaces: 0 },
  { component: 'inventory.set', id: 'items', items: ['a', 'a'] },
  { component: 'ownership.registry', id: 'assets', assets: ['a', 'a'] },
  {
    component: 'pawn.set',
    id: 'pawns',
    perPlayer: 1,
    pawns: [{ id: 'a' }, { id: 'a' }],
  },
  {
    component: 'pawn.set',
    id: 'pawns',
    perPlayer: 0.5,
    pawns: [{ id: 'a' }],
  },
  {
    component: 'quiz.bank',
    id: 'questions',
    questions: [
      { id: 'a', prompt: 'First', choices: ['a', 'b'], answerIndex: 0 },
      { id: 'a', prompt: 'Second', choices: ['a', 'b'], answerIndex: 1 },
    ],
  },
  {
    component: 'quiz.bank',
    id: 'questions',
    questions: [
      { id: 'a', prompt: 'First', choices: ['a', 'b'], answerIndex: 2 },
    ],
  },
])('rejects invalid raw component catalogs before runtime: %j', (component) => {
  expect(() => compile([component])).toThrow(/components[.[]/);
});

it.each([0, -1, 0.5, NaN, Infinity, 3])(
  'rejects invalid pawn quotas at the author factory: %s',
  (perPlayer) => {
    expect(() =>
      pawns.set({
        id: 'pawns',
        pawns: [{ id: 'a' }, { id: 'b' }],
        perPlayer,
      }),
    ).toThrow();
  },
);

it('preserves repeated free card values and identifiers scoped to different catalogs', () => {
  expect(() =>
    compile([
      { component: 'cards.deck', id: 'values', cards: [1, 1, 'a', 'a'] },
      { component: 'cards.deck', id: 'first', cards: [{ id: 'a' }] },
      { component: 'cards.deck', id: 'second', cards: [{ id: 'a' }] },
    ]),
  ).not.toThrow();
});

it.each(['groups', 'total'] as const)(
  'rejects unknown inventory references in collection %s',
  (field) => {
    const source = { kind: 'inventory' as const, id: 'missing' };
    expect(() =>
      compile([
        {
          component: 'collection.view',
          id: 'collection',
          groups: field === 'groups' ? { items: source } : {},
          ...(field === 'total' ? { total: source } : {}),
        },
      ]),
    ).toThrow('components.collection.inventories');
  },
);

it('resolves collection inventory references independently of declaration order', () => {
  expect(() =>
    compile([
      {
        component: 'collection.view',
        id: 'collection',
        groups: { items: { kind: 'inventory', id: 'items' } },
        total: { kind: 'inventory', id: 'items' },
      },
      { component: 'inventory.set', id: 'items', items: ['a'] },
    ]),
  ).not.toThrow();
});
