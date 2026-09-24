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
  adr: 'docs/architecture/adr-reuse.md',
  consumers: [
    {
      document: 'src/game/testing/first.json',
      objective: 'First objective: score through collection',
      turnStructure: 'Sequential turns with limited actions',
      interaction: 'Exchange resources between players',
    },
    {
      document: 'src/game/testing/second.json',
      objective: 'Second objective: survive fixed rounds',
      turnStructure: 'Simultaneous decisions each round',
      interaction: 'Cooperative protection from collisions',
    },
  ],
  tests: ['src/game/testing/reuse.spec.ts'],
  test: 'src/game/testing/reuse.spec.ts',
  rationale:
    'The test executes two independently designed mechanics using the same pack contract and checks their different initialization, legal actions and victory behavior without changing the implementation.',
};

test('a single consumer remains game-specific', () => {
  assert.equal(
    classifyEffectPack('pack', profile, consumers, readEvidence).scope,
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
        readEvidence,
      ),
    /maturity required/,
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...profile, maturity: 'stable' },
        consumers,
        readEvidence,
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
    classifyEffectPack('pack', reusable, consumers, readEvidence).maturity,
    'reusable',
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...reusable, maturity: 'stable' },
        consumers,
        readEvidence,
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
    classifyEffectPack('pack', stable, consumers, readEvidence).maturity,
    'stable',
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        stable,
        consumers,
        (file) => file !== 'src/game/second.spec.ts' && readEvidence(file),
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
          readEvidence,
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
        readEvidence,
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
        readEvidence,
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
        readEvidence,
      ),
    /mechanically different/,
  );
});
test('different mechanical consumers require explicit promotion with a review', () => {
  const games = [...consumers, { source: { setup: { scores: 10 } } }];
  assert.equal(
    classifyEffectPack('pack', profile, games, readEvidence).scope,
    'game-specific',
  );
  assert.equal(
    classifyEffectPack(
      'pack',
      { ...profile, scope: 'reusable', reuseReview: evidence },
      games,
      readEvidence,
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
    classifyEffectPack('pack', independent, consumers, readEvidence)
      .reuseEvidence,
    'independence-proof',
  );
  assert.throws(
    () =>
      classifyEffectPack(
        'pack',
        { ...independent, scope: 'engine-primitive' },
        consumers,
        readEvidence,
      ),
    /independent contract/,
  );
});

function readEvidence(file) {
  if (file.endsWith('.json'))
    return JSON.stringify({
      description:
        'An executable fixture whose complete configuration is reviewed independently.',
      victory: { kind: file.includes('first') ? 'score' : 'survival' },
    });
  return 'Status: accepted\nPack: pack\nsrc/game/testing/first.json\nsrc/game/testing/second.json\nThis review documents distinct objectives, interaction models and turn structures in an independently executable contract.';
}
