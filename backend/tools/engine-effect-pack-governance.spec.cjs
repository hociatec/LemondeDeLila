'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');

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
  assert.equal(policy.maximumProductionLines, 18770);
  assert.equal(policy.maximumBehaviorLines, 18694);
  assert.equal(policy.maximumFileBytes, 13500);
  assert(audit.summary.behaviorLines <= policy.maximumBehaviorLines);
  assert.deepEqual(audit.summary.scopes, {
    'game-specific': 38,
    reusable: 0,
    'engine-primitive': 0,
  });
  assert.equal(audit.summary.largeSingleConsumerReviews, 30);
  assert.equal(audit.summary.structuralCandidates, 3);
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
      /^(not-demonstrated|second-game|independence-proof)$/,
    );
    assert.equal(pack.scope, 'game-specific');
    assert.match(pack.domain, /^(board|cards|choice|collection|race|spatial)$/);
    assert(pack.reason.length >= 80);
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

test('copying a JSON game does not demonstrate reuse or automatically promote a pack', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-rule-reuse-'));
  const backend = path.resolve(__dirname, '..');
  try {
    fs.cpSync(path.join(backend, 'src/game/games'), directory, {
      recursive: true,
    });
    const documents = (root) =>
      fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(root, entry.name);
        return entry.isDirectory()
          ? documents(file)
          : entry.name === 'game.json'
            ? [file]
            : [];
      });
    const original = documents(directory).find((file) =>
      JSON.parse(fs.readFileSync(file, 'utf8')).extensions?.some(
        (extension) => extension.type === 'publicDomainCards',
      ),
    );
    assert(original);
    const target = path.join(directory, 'test-world', 'reused-collection');
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(original, path.join(target, 'game.json'));
    fs.writeFileSync(
      path.join(target, 'manifest.json'),
      JSON.stringify({ code: 'reused-collection' }),
    );
    const result = spawnSync(
      process.execPath,
      [
        path.join(__dirname, 'engine-effect-pack-governance.cjs'),
        '--games-root',
        directory,
      ],
      { cwd: backend, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const pack = JSON.parse(result.stdout).effectPacks.find(
      (pack) => pack.name === 'cards-public-domain',
    );
    assert.equal(pack.consumerCount, 2);
    assert.equal(pack.distinctMechanicalConsumers, 1);
    assert.equal(pack.scope, 'game-specific');
    assert.equal(pack.reuseEvidence, 'not-demonstrated');
    assert.equal(pack.reviewRequired, false);
  } finally {
    assert(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
