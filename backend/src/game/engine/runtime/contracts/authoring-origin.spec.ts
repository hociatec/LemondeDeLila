import {
  atAuthoringPath,
  authoringPathOf,
  withAuthoringPath,
} from './authoring-origin';
import { GameConfigurationError } from './game-domain.errors';
import { cards } from '../cards/cards-contracts';
import { quiz } from '../kits/quiz-kit';
import { GameContentValidationError } from './game-domain.errors';
import { economy } from '../kits/economy-kit';
import { grid } from '../kits/grid-kit';
import { pawns } from '../kits/pawn-kit';

it('preserves error identity, type, message and enumerable public fields', () => {
  const original = new GameConfigurationError('Invalid');
  const serialized = JSON.stringify(original);
  expect(withAuthoringPath(original, '[1].id')).toBe(original);
  expect(() =>
    atAuthoringPath('cards', () => {
      throw original;
    }),
  ).toThrow(original);
  expect(authoringPathOf(original)).toBe('cards[1].id');
  expect(JSON.stringify(original)).toBe(serialized);
  expect(original.message).toBe('Invalid');
});

it('passes through successful operations and ignores unrelated values', () => {
  expect(atAuthoringPath('cards', () => 7)).toBe(7);
  expect(authoringPathOf(new Error('Unrelated'))).toBeUndefined();
  expect(authoringPathOf('sentinel')).toBeUndefined();
});

it('isolates diagnostics by error identity, including frozen errors', () => {
  const first = Object.freeze(new GameConfigurationError('Same message'));
  const second = Object.freeze(new GameConfigurationError('Same message'));
  withAuthoringPath(first, 'cards[1].id');
  withAuthoringPath(second, 'questions[2].answerIndex');
  expect(authoringPathOf(first)).toBe('cards[1].id');
  expect(authoringPathOf(second)).toBe('questions[2].answerIndex');
  expect(Object.isFrozen(first)).toBe(true);
});

it('keeps content error types for SDK factories', () => {
  expect(() =>
    cards.deck({ id: 'd', cards: [{ id: 'a' }, { id: 'a' }] }),
  ).toThrow(GameContentValidationError);
  expect(() =>
    quiz.bank({
      id: 'q',
      questions: [
        { id: 'q', prompt: '?', choices: ['a', 'b'], answerIndex: 9 },
      ],
    }),
  ).toThrow(GameContentValidationError);
});

it.each([
  [
    () =>
      economy.market({
        id: 'm',
        inventory: 'i',
        currency: 'c',
        prices: { 'item.one': -1 },
      }),
    'prices["item.one"]',
  ],
  [
    () =>
      economy.market({
        id: 'm',
        inventory: 'i',
        currency: 'c',
        prices: { a: 1 },
        minPrice: 3,
        maxPrice: 2,
      }),
    'maxPrice',
  ],
  [() => grid.board({ id: 'g', width: 3, height: 0 }), 'height'],
  [
    () =>
      pawns.set({ id: 'p', pawns: [{ id: 'a' }], spaces: 5, entryPosition: 5 }),
    'entryPosition',
  ],
] as const)(
  'keeps SDK factory errors with precise field metadata %#',
  (create, path) => {
    let caught: unknown;
    try {
      create();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GameConfigurationError);
    expect(authoringPathOf(caught)).toBe(path);
  },
);
