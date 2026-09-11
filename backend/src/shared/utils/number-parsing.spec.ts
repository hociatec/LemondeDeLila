import { parseStrictInteger, parseStrictNumber } from './number-parsing';

it.each([
  true,
  false,
  null,
  undefined,
  [],
  [1],
  {},
  '',
  ' ',
  '0x10',
  '7-table',
  'NaN',
  'Infinity',
  Infinity,
  NaN,
])('rejects non-decimal numeric input %p', (value) => {
  expect(parseStrictNumber(value)).toBeNull();
  expect(parseStrictInteger(value)).toBeNull();
});
it('supports finite decimal measures but only safe integers for integer fields', () => {
  expect(parseStrictNumber('1.25e2')).toBe(125);
  expect(parseStrictNumber('-.5')).toBe(-0.5);
  expect(parseStrictNumber('1e999')).toBeNull();
  expect(parseStrictInteger('1.0')).toBeNull();
  expect(parseStrictInteger('1e3')).toBeNull();
  expect(parseStrictInteger(1.5)).toBeNull();
  expect(parseStrictInteger(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
  expect(parseStrictInteger(' 42 ', { min: 1, max: 100 })).toBe(42);
  expect(parseStrictInteger('-4')).toBe(-4);
  expect(parseStrictInteger('101', { max: 100 })).toBeNull();
  expect(parseStrictInteger('0', { min: 1 })).toBeNull();
});
