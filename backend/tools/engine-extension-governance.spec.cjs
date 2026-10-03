'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('engine-extension governance reports every consumer, domain, LOC and reason', () => {
  const backend = path.resolve(__dirname, '..');
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'engine-extension-governance.cjs')],
    { cwd: backend, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const audit = JSON.parse(result.stdout);
  const policy = require('./engine-extension-governance.json');
  assert.equal(audit.engineExtensions.length, audit.summary.programFiles);
  assert.equal(audit.summary.registeredEngineExtensions, 0);
  assert.equal(
    audit.summary.productionLines,
    audit.engineExtensions.reduce((total, extension) => total + extension.productionLines, 0),
  );
  assert(audit.summary.productionLines <= policy.maximumProductionLines);
  assert.equal(policy.maximumProductionLines, 19076);
  assert.equal(policy.maximumBehaviorLines, 19000);
  assert.equal(policy.maximumFileBytes, 13500);
  assert(audit.summary.behaviorLines <= policy.maximumBehaviorLines);
  assert.deepEqual(audit.summary.scopes, {
    reusable: 0,
    'engine-primitive': 0,
  });
  assert.equal(audit.summary.largeSingleConsumerReviews, 0);
  assert.equal(audit.summary.structuralCandidates, 0);
  assert.equal(audit.summary.exactGameCodeMatches, 0);
  assert.equal(audit.summary.forbiddenVocabularyMatches, 0);
  assert.equal(audit.summary.crossExtensionImplementationImports, 0);

  const names = new Set();
  for (const extension of audit.engineExtensions) {
    assert(!names.has(extension.name), `duplicate engine extension ${extension.name}`);
    names.add(extension.name);
    assert.match(extension.family, /^(board|cards|choice|collection|race|spatial)$/);
    assert(extension.productionLines > 0);
    assert(extension.behaviorLines > 0);
    assert.equal(extension.consumerCount, extension.consumers.length);
    assert.equal(
      extension.linesPerConsumer,
      extension.consumerCount === 0
        ? null
        : Math.round(extension.productionLines / extension.consumerCount),
    );
    assert.match(
      extension.reuseEvidence,
      /^(not-demonstrated|second-game|independence-proof)$/,
    );
    assert.match(extension.scope, /^(reusable|engine-primitive)$/);
    assert.match(extension.domain, /^(board|cards|choice|collection|race|spatial)$/);
    assert(extension.reason.length >= 80);
    assert(Array.isArray(extension.consumers));
    assert(extension.consumers.every((consumer) => consumer.endsWith('/game.json')));
  }
  assert.deepEqual(Object.keys(audit.domains), []);
  for (const domain of Object.values(audit.domains)) {
    assert(domain.extensions > 0);
    assert(domain.productionLines > 0);
    assert.equal(domain.reviewedPatterns.length, domain.extensions);
  }
});
