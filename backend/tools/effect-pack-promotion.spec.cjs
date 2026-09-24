'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePromotion } = require('./effect-pack-promotion.cjs');
const { assertPrimitiveSource } = require('./effect-pack-promotion.cjs');

test('primitive implementation cannot hide game vocabulary behind a neutral contract', () => {
  for (const identifier of ['bananaCount', 'BananaCount', 'BANANA_COUNT'])
    assert.throws(
      () =>
        assertPrimitiveSource('implementation.ts', `const ${identifier} = 1;`, [
          'banana',
        ]),
      /vocabulary/,
    );
  assert.throws(
    () =>
      assertPrimitiveSource(
        'implementation.ts',
        'const namedGame = "named-game";',
        ['named-game'],
      ),
    /vocabulary/,
  );
  assert.throws(
    () =>
      assertPrimitiveSource(
        'implementation.ts',
        "import { X } from '../../../core/application/x';",
        [],
      ),
    /application layer/,
  );
  assert.doesNotThrow(() =>
    assertPrimitiveSource('implementation.ts', 'const remaining = 4;', [
      'mine',
    ]),
  );
});
const consumers = [
  {
    document: 'src/game/testing/a.json',
    objective: 'Collect objects to satisfy a personal goal',
    turnStructure: 'Sequential choices with limited action points',
    interaction: 'Competitive trading between two players',
  },
  {
    document: 'src/game/testing/b.json',
    objective: 'Survive a fixed number of shared rounds',
    turnStructure: 'Simultaneous choices with collective resolution',
    interaction: 'Cooperative protection against collisions',
  },
];
const independent = 'src/game/testing/independent.spec.ts';
const composition = 'src/game/testing/composition.spec.ts';
const profile = {
  scope: 'reusable',
  property: 'energy',
  reuseReview: {
    adr: 'docs/architecture/adr-energy.md',
    consumers,
    test: independent,
    tests: [independent, composition],
  },
};
const read = (file) =>
  file.endsWith('.json')
    ? JSON.stringify({
        description:
          'Reviewed independent fixture with its own objective and turn structure.',
        extensions: [{ type: 'energy', config: {} }],
        victory: { kind: file.endsWith('a.json') ? 'score' : 'survival' },
      })
    : file.endsWith('.md')
      ? `Status: accepted\nPack: energy\n${consumers.map((c) => c.document).join('\n')}\nReview of independent gameplay and compatibility consequences.`
      : '/* Standalone test or low-level contract, with reviewed composition invariants and no game vocabulary. */';
test('a label change and unaccepted reviews cannot promote a pack', () => {
  assert.throws(
    () =>
      validatePromotion('energy', profile, (file) =>
        read(file).replace('Pack: energy', 'Not-Pack: energy'),
      ),
    /name this pack/,
  );
  assert.throws(
    () => validatePromotion('energy', { scope: 'reusable' }, read),
    /accepted ADR/,
  );
  assert.throws(
    () =>
      validatePromotion('energy', profile, (file) =>
        read(file).replace('Status: accepted', 'Status: proposed'),
      ),
    /accepted/,
  );
  assert.throws(
    () => validatePromotion('energy', profile, () => true),
    /source text/,
  );
});
test('promotion requires two actual consumers and independent reviewed mechanics', () => {
  assert.deepEqual(validatePromotion('energy', profile, read), [
    independent,
    composition,
  ]);
  assert.deepEqual(
    validatePromotion('energy', profile, (file) =>
      read(file).replaceAll('\n', '\r\n'),
    ),
    [independent, composition],
  );
  for (const invalid of [
    [consumers[0]],
    [consumers[0], consumers[0]],
    [consumers[0], { ...consumers[0], document: consumers[1].document }],
  ]) {
    assert.throws(() =>
      validatePromotion(
        'energy',
        {
          ...profile,
          reuseReview: { ...profile.reuseReview, consumers: invalid },
        },
        read,
      ),
    );
  }
  assert.throws(
    () =>
      validatePromotion('energy', profile, (file) =>
        read(file).replace('"energy"', '"unrelated"'),
      ),
    /actually enable/,
  );
});
test('a primitive needs neutral contracts and separate executed composition evidence', () => {
  const primitive = {
    ...profile,
    scope: 'engine-primitive',
    primitiveContract: 'src/game/engine/runtime/contracts/energy.ts',
    primitiveReview: {
      independentTest: independent,
      compositionTest: composition,
      forbiddenVocabulary: ['named-game'],
    },
  };
  assert.deepEqual(validatePromotion('energy', primitive, read), [
    independent,
    composition,
  ]);
  assert.throws(
    () =>
      validatePromotion(
        'energy',
        {
          ...primitive,
          primitiveReview: {
            ...primitive.primitiveReview,
            compositionTest: independent,
          },
        },
        read,
      ),
    /separate/,
  );
  assert.throws(
    () =>
      validatePromotion(
        'energy',
        primitive,
        (file) =>
          read(file) + (file.endsWith('energy.ts') ? ' named-game ' : ''),
      ),
    /vocabulary/,
  );
  assert.throws(
    () =>
      validatePromotion(
        'energy',
        primitive,
        (file) =>
          read(file) +
          (file.endsWith('energy.ts')
            ? "import type { X } from '../../../rules/game-specific/x';"
            : ''),
      ),
    /application layer/,
  );
});
