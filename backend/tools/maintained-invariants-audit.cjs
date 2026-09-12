#!/usr/bin/env node
/* eslint-disable no-console */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) =>
  assert(
    fs.existsSync(path.join(root, file)),
    `Missing invariant proof: ${file}`,
  );
const contains = (file, expression) =>
  assert(
    expression.test(read(file)),
    `Missing invariant in ${file}: ${expression}`,
  );

for (const file of [
  'tools/runtime-dependency-graph.spec.cjs',
  'tools/game-engine-architecture-check.cjs',
  'tools/runtime-separation-audit.cjs',
  'tools/game-content-structure-audit.cjs',
  'tools/content-release-policy.spec.cjs',
  'tools/security-boundary-audit.cjs',
  'tools/persistence-audit.cjs',
  'tools/infrastructure-retry-audit.cjs',
  'tools/operability-audit.cjs',
  'tools/observability-contract-check.cjs',
  'tools/dead-code-audit.cjs',
  'src/game/engine/runtime/definitions/component-reference-validation.spec.ts',
  'src/game/engine/runtime/definitions/json-version-policy.spec.ts',
  'src/game/engine/runtime/definitions/json-restored-session.spec.ts',
  'src/game/engine/runtime/definitions/static-effect-references.spec.ts',
  'src/game/engine/runtime/state/assert-serializable-state.spec.ts',
  'src/game/engine/runtime/state/setup-state-isolation.spec.ts',
  'src/game/engine/runtime/lifecycle/automatic-stabilization.spec.ts',
  'src/game/core/application/services/game-command-idempotency.spec.ts',
  'src/game/core/application/services/game-snapshot-serialization.spec.ts',
  'src/game/core/infrastructure/scheduling/game-session-reconciliation.spec.ts',
  'src/platform/realtime/infrastructure/presentation/ws/realtime-request-replay.service.spec.ts',
  'src/platform/database/migrations/migration-history.spec.ts',
  'src/platform/lifecycle/application/application-shutdown.service.spec.ts',
  'src/modules/update/infrastructure/persistence/wx-update-release.service.spec.ts',
  'src/modules/user/infrastructure/security/redis-refresh-token.service.spec.ts',
  'docs/architecture/engine-extension-governance.md',
  'docs/architecture/engine-snapshot-migrations.md',
  'docs/architecture/game-automation-delivery.md',
  'docs/architecture/game-event-contract.md',
  'docs/architecture/realtime-resilience-test-matrix.md',
  'docs/architecture/table-ownership.md',
  'docs/architecture/production-readiness.md',
  'docs/quality/corrections-130-2026-09-12.md',
])
  exists(file);

contains(
  'tools/runtime-dependency-graph.spec.cjs',
  /complete production source tree has no TypeScript dependency cycle/,
);
contains(
  'tools/game-engine-architecture-check.cjs',
  /json-game-no-executable-source/,
);
contains('tools/architecture-check.cjs', /public-api-no-typeorm-entity/);
contains(
  'src/game/engine/runtime/definitions/json-game-schema.ts',
  /freezeAuthorSchema/,
);
contains(
  'src/game/engine/runtime/content/content-immutability.ts',
  /Object\.freeze/,
);
contains(
  'src/game/core/application/services/game-command-executor.service.ts',
  /gameCommandFingerprint/,
);
contains(
  'src/platform/realtime/infrastructure/presentation/ws/realtime-request-replay.service.ts',
  /existing\.fingerprint !== fingerprint/,
);
contains(
  'src/platform/validation/application/services/json-input-limits.ts',
  /MAX_DEPTH/,
);
contains(
  'src/modules/update/infrastructure/persistence/wx-update-artifact-validator.service.ts',
  /sha256/,
);
contains(
  'src/platform/database/migrations/migration-history.spec.ts',
  /sha256/,
);
contains(
  'src/game/engine/runtime/state/assert-serializable-state.ts',
  /assertSerializableState/,
);
contains(
  'src/game/core/infrastructure/scheduling/game-task-job-id.ts',
  /restoreId/,
);

const errors = read('src/game/core/domain/errors/game-errors.ts');
assert(
  !/timestamp:\s*new Date\(\)/.test(errors),
  'Domain errors must not invent a business timestamp',
);

const gameRoot = path.join(root, 'src/game/games');
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const productionTs = walk(gameRoot).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'),
);
assert.deepEqual(productionTs, [], 'Game packages must remain data-only');
for (const file of walk(gameRoot).filter(
  (candidate) => path.basename(candidate) === 'game.json',
)) {
  assert(
    read(path.relative(root, file)).split(/\r?\n/).length <= 301,
    `${file} exceeds the modular game.json limit`,
  );
}

const scripts = JSON.parse(read('package.json')).scripts;
for (const command of [
  'architecture:test',
  'game-engine:audit',
  'engine:extensions:audit',
  'invariants:audit',
  'security:audit',
  'persistence:audit',
  'retries:audit',
  'operability:audit',
  'observability:audit',
  'architecture:debt-final',
])
  assert(
    scripts['quality:check'].includes(command),
    `${command} must run in quality:check`,
  );

console.log(
  'maintained-invariants-audit: cross-cutting production contracts present',
);
