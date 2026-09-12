import { assertAuthorJson } from './json-author-schema';
import { parseJsonGame } from '../definitions/json-game-parser';
import document from '../../../testing/fixtures/json-course/game.json';

it('bounds cumulative UTF-8 text even when each individual string is allowed', () => {
  const text = '\u00e9'.repeat(32_768);
  expect(() => assertAuthorJson(Array(129).fill(text))).toThrow(/text limit/);
  expect(() => assertAuthorJson(Array(127).fill(text))).not.toThrow();
});

it('accounts for object keys before constructing diagnostic paths', () => {
  const value = { ['x'.repeat(65_537)]: null };
  expect(() => assertAuthorJson(value)).toThrow('JSON text limit exceeded');
});

it.each([
  NaN,
  Infinity,
  -Infinity,
  Number.MAX_SAFE_INTEGER + 1,
  -Number.MAX_SAFE_INTEGER - 1,
])('rejects numbers outside the deterministic numeric domain: %s', (value) => {
  expect(() => assertAuthorJson({ value })).toThrow();
});

it('keeps safe negative, fractional and maximum numeric values', () => {
  expect(() =>
    assertAuthorJson([-0.5, 0, Number.MAX_SAFE_INTEGER]),
  ).not.toThrow();
});

it('enforces the numeric bound through the game JSON boundary', () => {
  expect(() =>
    parseJsonGame({
      ...document,
      setup: { scores: Number.MAX_SAFE_INTEGER + 1 },
    }),
  ).toThrow();
});
