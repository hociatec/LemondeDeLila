import {
  evaluateNumericExpression,
  evaluateResourceAmount,
} from './numeric-expression-evaluator';
import { validateNumericExpression } from './numeric-expression-validator';
import type { NumericExpression } from '../contracts/numeric-expression';
import { assertEffectJson } from '../contracts/effect-json-schema';

const context = {
  resources: { get: () => 0 },
  score: { get: () => 3 },
  movement: { position: () => 2 },
  cards: { hand: () => [] },
  inventory: { items: () => ['a', 'b', 'a'] },
  players: { all: () => [], active: () => [] },
};
const references = {
  decks: new Map(),
  hands: new Map([['hand', {}]]),
  inventories: new Map([['bag', {}]]),
  tracks: new Set(['board']),
  diceSets: new Set<string>(),
  resources: new Set(['gold']),
};
const validate = (expression: NumericExpression) =>
  validateNumericExpression(
    expression,
    '$.amount',
    references,
    (path, reason) => {
      throw new Error(`${path}: ${reason}`);
    },
  );

it('rejects unsafe intermediate results and dynamic division by zero', () => {
  for (const expression of [
    {
      kind: 'divide',
      left: 5,
      right: { kind: 'resource-value', resource: 'gold' },
    },
    { kind: 'multiply', left: Number.MAX_SAFE_INTEGER, right: 2 },
    { kind: 'clamp', value: 2, min: { kind: 'score-value' }, max: 1 },
  ] satisfies NumericExpression[]) {
    expect(() => validate(expression)).not.toThrow();
    expect(() => evaluateNumericExpression(expression, context, 1)).toThrow();
  }
});

it('rejects negative resource amounts while allowing negative scores', () => {
  const expression: NumericExpression = { kind: 'subtract', left: 1, right: 2 };
  expect(evaluateNumericExpression(expression, context, 1)).toBe(-1);
  expect(() => evaluateResourceAmount(expression, context, 1)).toThrow();
});

it('bounds both depth and total work before execution', () => {
  let deep: NumericExpression = 1;
  for (let i = 0; i < 18; i++) deep = { kind: 'add', left: deep, right: 1 };
  let broad: NumericExpression = 1;
  for (let i = 0; i < 8; i++)
    broad = { kind: 'add', left: broad, right: broad };
  for (const expression of [deep, broad]) {
    expect(() => validate(expression)).toThrow(/budget/);
    expect(() => evaluateNumericExpression(expression, context, 1)).toThrow();
  }
});

it('reports unresolved references with their authoring path', () => {
  expect(() =>
    validate({ kind: 'resource-value', resource: 'missing' }),
  ).toThrow('$.amount.resource: unknown reference missing');
  expect(() => validate({ kind: 'divide', left: 5, right: 0 })).toThrow(
    /division/,
  );
});

it.each([
  { kind: 'random' },
  { kind: 'state', path: 'secret' },
  { kind: 'add', left: 1, right: 2, execute: 'custom()' },
  { kind: 'loop', count: 100 },
  { kind: 'score-value', playerId: 2 },
])('rejects unbounded or untyped expression forms: %j', (amount) => {
  expect(() => assertEffectJson([{ kind: 'gain-score', amount }])).toThrow();
});
