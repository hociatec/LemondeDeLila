'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('effect-pack governance reports every consumer, domain, LOC and reason', () => {
  const backend = path.resolve(__dirname, '..');
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'engine-effect-pack-governance.cjs')],
    { cwd: backend, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const audit = JSON.parse(result.stdout);
  const policy = require('./engine-effect-pack-governance.json');
  assert.equal(audit.effectPacks.length, audit.summary.programFiles);
  assert.equal(audit.summary.registeredEffectPacks, 38);
  assert.equal(
    audit.summary.productionLines,
    audit.effectPacks.reduce((total, pack) => total + pack.productionLines, 0),
  );
  assert(audit.summary.productionLines <= policy.maximumProductionLines);
  assert(audit.summary.behaviorLines <= policy.maximumBehaviorLines);
  assert.equal(audit.summary.genericScopeEffectPacks, 38);
  assert.equal(audit.summary.largeSingleConsumerReviews, 22);
  assert.equal(audit.summary.structuralCandidates, 2);
  assert.equal(audit.summary.exactGameCodeMatches, 0);
  assert.equal(audit.summary.forbiddenVocabularyMatches, 0);
  assert.equal(audit.summary.crossPackImplementationImports, 0);

  const names = new Set();
  for (const pack of audit.effectPacks) {
    assert(!names.has(pack.name), `duplicate effect pack ${pack.name}`);
    names.add(pack.name);
    assert.match(pack.family, /^(board|cards|choice|collection|race|spatial)$/);
    assert(pack.productionLines > 0);
    assert(pack.behaviorLines > 0);
    assert.equal(pack.consumerCount, pack.consumers.length);
    assert.equal(
      pack.linesPerConsumer,
      pack.consumerCount === 0
        ? null
        : Math.round(pack.productionLines / pack.consumerCount),
    );
    assert.match(
      pack.reuseEvidence,
      /^(designed|demonstrated|support-profile)$/,
    );
    assert.equal(pack.scope, 'generic');
    assert.match(pack.domain, /^(board|cards|choice|collection|race|spatial)$/);
    assert.match(pack.reason, /^generic \w+ capability: /);
    assert(Array.isArray(pack.consumers));
    assert(pack.consumers.every((consumer) => consumer.endsWith('/game.json')));
  }
  assert.deepEqual(Object.keys(audit.domains).sort(), [
    'board',
    'cards',
    'choice',
    'collection',
    'race',
    'spatial',
  ]);
  for (const domain of Object.values(audit.domains)) {
    assert(domain.packs > 0);
    assert(domain.productionLines > 0);
    assert.equal(domain.reviewedPatterns.length, domain.packs);
  }
});
