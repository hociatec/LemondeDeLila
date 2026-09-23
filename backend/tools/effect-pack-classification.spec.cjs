'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  classifyEffectPack,
  mechanicalFingerprint,
} = require('./effect-pack-classification.cjs');

const profile = {
  scope: 'game-specific',
  maturity: 'experimental',
  classificationReason:
    'Only one mechanical use case is present in the production catalogue. Configuration and renamed copies do not establish reusable behavior.',
};
const consumers = [{ source: { world: 'one', setup: { scores: 0 } } }];

test('changing the extension transport does not count as a second mechanic', () => {
  assert.equal(
    mechanicalFingerprint({ actions: {}, race: { distance: 3 } }),
    mechanicalFingerprint({
      actions: {},
      extensions: [{ type: 'race', config: { distance: 3 } }],
    }),
  );
});
const evidence = {
  kind: 'second-game',
  test: 'src/game/testing/reuse.spec.ts',
  rationale:
    'The test executes two independently designed mechanics using the same pack contract and checks their different initialization, legal actions and victory behavior without changing the implementation.',
};

test('a single consumer remains game-specific', () => {
  assert.equal(
    classifyEffectPack('pack', profile, consumers, () => true).scope,
    'game-specific',
  );
});

test('maturity cannot be promoted by changing a label alone', () => {
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...profile, maturity: undefined },
        consumers,
        () => true,
      ),
    /maturity required/,
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...profile, maturity: 'stable' },
        consumers,
        () => true,
      ),
    /demonstrated reuse/,
  );
  const reusable = {
    ...profile,
    scope: 'reusable',
    maturity: 'reusable',
    reuseReview: { ...evidence, kind: 'independence-proof' },
  };
  assert.equal(
    classifyEffectPack('pack', reusable, consumers, () => true).maturity,
    'reusable',
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...reusable, maturity: 'stable' },
        consumers,
        () => true,
      ),
    /versioned compatibility/,
  );
  const stable = {
    ...reusable,
    maturity: 'stable',
    stabilityReview: {
      contractVersion: 1,
      compatibilityPolicy: 'docs/contract.md',
      tests: ['src/game/first.spec.ts', 'src/game/second.spec.ts'],
    },
  };
  assert.equal(
    classifyEffectPack('pack', stable, consumers, () => true).maturity,
    'stable',
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        stable,
        consumers,
        (file) => file !== 'src/game/second.spec.ts',
      ),
    /versioned compatibility/,
  );
});
test('generic and missing classifications are rejected', () => {
  for (const scope of ['generic', undefined, 'stable'])
    assert.throws(
      () =>
        classifyEffectPack(
          'pack',
          { ...profile, scope },
          consumers,
          () => true,
        ),
      /scope required/,
    );
});
test('a reusable claim requires an executable, precise review', () => {
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...profile, scope: 'reusable' },
        consumers,
        () => true,
      ),
    /independence review/,
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...profile, scope: 'reusable', reuseReview: evidence },
        consumers,
        () => false,
      ),
    /independence review/,
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        {
          ...profile,
          scope: 'reusable',
          reuseReview: { ...evidence, test: 'proof.md' },
        },
        consumers,
        () => true,
      ),
    /independence review/,
  );
});
test('renaming, formatting and reordering a document cannot count as distinct mechanics', () => {
  const copy = {
    setup: { scores: 0 },
    world: 'two',
    presentation: { name: 'Different title' },
  };
  assert.equal(
    mechanicalFingerprint(copy),
    mechanicalFingerprint(consumers[0].source),
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...profile, scope: 'reusable', reuseReview: evidence },
        [...consumers, { source: copy }],
        () => true,
      ),
    /mechanically different/,
  );
});
test('different mechanical consumers require explicit promotion with a review', () => {
  const games = [...consumers, { source: { setup: { scores: 10 } } }];
  assert.equal(
    classifyEffectPack('pack', profile, games, () => true).scope,
    'game-specific',
  );
  assert.equal(
    classifyEffectPack(
      'pack',
      { ...profile, scope: 'reusable', reuseReview: evidence },
      games,
      () => true,
    ).scope,
    'reusable',
  );
});
test('single-consumer independence proof and engine primitive contract are explicit', () => {
  const independent = {
    ...profile,
    scope: 'reusable',
    reuseReview: { ...evidence, kind: 'independence-proof' },
  };
  assert.equal(
    classifyEffectPack('pack', independent, consumers, () => true)
      .reuseEvidence,
    'independence-proof',
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...independent, scope: 'engine-primitive' },
        consumers,
        () => true,
      ),
    /independent contract/,
  );
});
