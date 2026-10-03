'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  assertProductionTree,
  isForbiddenArtifactEntry,
  pruneProductionTree,
} = require('./create-deployment-artifact.cjs');

test('classifies development-only artifact entries without rejecting runtime files', () => {
  assert.equal(isForbiddenArtifactEntry('dist/game.spec.js', false), true);
  assert.equal(isForbiddenArtifactEntry('node_modules/pkg/tests', true), false);
  assert.equal(
    isForbiddenArtifactEntry('node_modules/pkg/fixtures', true),
    false,
  );
  assert.equal(isForbiddenArtifactEntry('dist/.env.production', false), true);
  assert.equal(
    isForbiddenArtifactEntry('dist/private-signing-key', false),
    true,
  );
  assert.equal(
    isForbiddenArtifactEntry('node_modules/pkg/.github', true),
    false,
  );
  assert.equal(isForbiddenArtifactEntry('dist/main.js', false), false);
});

test('prunes development-only entries from staging and keeps runtime payloads', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-prune-test-'));
  try {
    for (const relative of [
      'dist/main.js',
      'dist/game.spec.js',
      'node_modules/pkg/index.js',
      'node_modules/pkg/tests/example.test.js',
      'node_modules/pkg/fixtures/example.json',
      'node_modules/pkg/.github/workflows/ci.yml',
    ]) {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'x');
    }

    assert.throws(() => assertProductionTree(root), /fichiers inutiles/);
    pruneProductionTree(root);
    assert.doesNotThrow(() => assertProductionTree(root));
    assert.equal(fs.existsSync(path.join(root, 'dist/main.js')), true);
    assert.equal(
      fs.existsSync(path.join(root, 'node_modules/pkg/index.js')),
      true,
    );
    assert.equal(
      fs.existsSync(
        path.join(root, 'node_modules/pkg/.github/workflows/ci.yml'),
      ),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, 'node_modules/pkg/fixtures/example.json')),
      true,
    );
    assert.equal(
      fs.existsSync(
        path.join(root, 'node_modules/pkg/tests/example.test.js'),
      ),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
