'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const ts = require('typescript');
const { schemaType } = require('./author-schema-types.cjs');
const { checkCodecContracts } = require('./effect-pack-codec-contract.cjs');

function accepts(schema, expected) {
  const file = path.resolve('__schema_type_test__.ts');
  const source = `type Actual = ${schemaType(schema)}; export function check(value: Actual): ${expected} { return value; }`;
  const options = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2023,
    types: [],
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (name, version, ...rest) =>
    path.resolve(name) === file
      ? ts.createSourceFile(name, source, version, true)
      : read(name, version, ...rest);
  return (
    ts.getPreEmitDiagnostics(ts.createProgram([file], options, host)).length ===
    0
  );
}

test('all registered schemas produce values assignable to their actual compile input', () => {
  assert.equal(checkCodecContracts(), 38);
});

test('schema/type drift rejects missing fields, wrong scalars and broadened discriminators', () => {
  const schema = {
    type: 'object',
    properties: { count: { type: 'number' } },
    required: ['count'],
  };
  assert.equal(accepts(schema, '{ count: number }'), true);
  assert.equal(
    accepts({ ...schema, required: [] }, '{ count: number }'),
    false,
  );
  assert.equal(
    accepts(
      { ...schema, properties: { count: { type: 'string' } } },
      '{ count: number }',
    ),
    false,
  );
  assert.equal(accepts({ enum: ['one', 'two'] }, "'one'"), false);
  assert.equal(
    accepts(
      { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      'readonly [number, number]',
    ),
    true,
  );
  assert.equal(
    accepts(
      { type: 'array', items: { type: 'number' } },
      'readonly [number, number]',
    ),
    false,
  );
});

test('unknown vocabulary and unresolved references cannot silently become unknown or any', () => {
  assert.throws(
    () => schemaType({ $ref: '#/$defs/missing' }),
    /Unknown schema reference/,
  );
  assert.throws(() => schemaType({ type: 'array' }), /requires items/);
  assert.throws(() => schemaType({}), /Unsupported authoring grammar/);
});
