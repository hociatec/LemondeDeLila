const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  analyzeArchitecture,
  compareGroups,
  describeComponent,
  detectLayer,
  detectStronglyConnectedComponents,
  groupViolations,
  isAllowedDependency,
  isCompositionSource,
} = require('./architecture-check.cjs');
const contract = require('./architecture-contract.json');

test('only the declared boundary assembly directory belongs to root composition', () => {
  assert.equal(describeComponent('app/boundaries/app-bot.adapter.ts', contract).kind, 'composition');
  assert.equal(describeComponent('app/database/typeorm-entities.ts', contract).kind, 'composition');
  assert.equal(describeComponent('app/database-other/service.ts', contract).kind, 'domain');
  assert.equal(describeComponent('app/business/service.ts', contract).kind, 'domain');
  assert.equal(describeComponent('app/boundaries-other/service.ts', contract).kind, 'domain');
  assert.equal(describeComponent('modules/room/application/service.ts', contract).kind, 'domain');
});

test('rejects nested contract models and mutable application dependencies in migrations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-contract-migration-'));
  try {
    const fixtures = {
      'modules/user/application/contracts/nested/user.model.ts': 'export interface UserModel {}',
      'modules/user/application/contracts/user.record.ts': 'export interface UserRecord {}',
      'modules/user/application/models/user.model.ts': 'export interface UserModel {}',
      'modules/user/application/contracts/user.contract.ts': 'export interface UserContract {}',
      'platform/database/migrations/100-invalid.ts': "import type { UserModel } from '../../../modules/user/application/models/user.model';",
      'platform/database/migrations/101-dynamic.ts': "const model = require('../../../modules/user/application/models/user.model');",
      'platform/database/migrations/102-valid.ts': "import type { MigrationInterface } from 'typeorm'; import { join } from 'node:path';",
    };
    for (const [relative, content] of Object.entries(fixtures)) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const violations = analyzeArchitecture({ root, contract }).violations;
    assert.equal(violations.filter(item => item.rule === 'contracts-no-data-model').length, 2);
    assert.equal(violations.filter(item => item.rule === 'migration-no-application-dependency').length, 2);
  } finally {
    assert(fs.realpathSync(root).startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects infrastructure exports and composition imports from business code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-api-boundary-'));
  try {
    const fixtures = {
      'modules/user/infrastructure/service.ts': 'export class UserImplementation {}',
      'modules/user/public-api.ts': "export { UserImplementation } from './infrastructure/service';",
      'modules/user/composition-api.ts': 'export class UserModule {}',
      'modules/room/application/service.ts': "import { UserModule } from '../../user/composition-api'; export const wrong = UserModule;",
    };
    for (const [relative, content] of Object.entries(fixtures)) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const rules = analyzeArchitecture({ root, contract }).violations.map(item => item.rule);
    assert(rules.includes('business-api-infrastructure-export'));
    assert(rules.includes('composition-api-consumer'));
  } finally {
    assert(fs.realpathSync(root).startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('public entries cannot hide infrastructure through barrels, aliases or local exports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-export-origins-'));
  try {
    const fixtures = {
      'modules/user/infrastructure/storage.ts': 'export class Storage {} export interface Row {}',
      'modules/user/contracts.ts': 'export interface Contract {}',
      'modules/user/bridge.ts': "export * from './infrastructure/storage'; export type { Contract } from './contracts';",
      'modules/user/alias.ts': "import { Storage as LocalStorage } from './bridge'; export { LocalStorage as Renamed };",
      'modules/user/module/user.module.ts': 'export class UserModule {}',
    };
    for (const [relative, content] of Object.entries(fixtures)) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const entry = path.join(root, 'modules/user/public-api.ts');
    for (const source of [
      "export * from './bridge';",
      "export { Renamed } from './alias';",
      "export type { Row } from './bridge';",
      "import { Renamed } from './alias'; export { Renamed as Storage };",
      "import { Renamed } from './alias'; export default Renamed;",
      "export * as storage from './infrastructure/storage';",
      "export * as storage from './bridge';",
      "export { UserModule } from './module/user.module';",
    ]) {
      fs.writeFileSync(entry, source);
      const violations = analyzeArchitecture({ root, contract }).violations;
      assert(violations.some(item => item.rule === 'business-api-infrastructure-export'), source);
    }
    // Importing a mixed barrel is safe when only its contract is exposed.
    fs.writeFileSync(entry, "export type { Contract } from './bridge';");
    assert(!analyzeArchitecture({ root, contract }).violations.some(
      item => item.rule === 'business-api-infrastructure-export'));
    fs.writeFileSync(entry, "export type { Contract } from './contracts';");
    fs.writeFileSync(path.join(root, 'modules/user/composition-api.ts'),
      "export { UserModule } from './module/user.module';");
    assert(!analyzeArchitecture({ root, contract }).violations.some(
      item => item.rule === 'business-api-infrastructure-export'));
  } finally {
    assert(fs.realpathSync(root).startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('readers expose queries without persistence or filesystem writes', () => {
  const { inspectReaderBoundary } = require('./reader-boundary.cjs');
  for (const source of [
    'repository.save(value);',
    'interface Reader { save(value: object): Promise<void>; }',
    'repository.delete(id);',
    "fs.writeFileSync('state.json', body);",
    "db.query('DELETE FROM users WHERE id = ?', [id]);",
  ]) assert(inspectReaderBoundary('fixture.reader.ts', source).length, source);
  assert.deepEqual(inspectReaderBoundary('fixture.reader.ts',
    "const rows = await repository.find({ take: 20 }); return rows.map(row => ({ id: row.id }));"), []);
});

test('policies decide from explicit data without services, callbacks or ambient values', () => {
  const { inspectPolicyPurity } = require('./policy-purity.cjs');
  for (const source of [
    'class Policy { constructor(private readonly clock: Clock) {} }',
    'async function decide() { return await reader.get(); }',
    'function decide(read: () => boolean) { return read(); }',
    'const now = Date.now();',
    'const now = new Date();',
    'const value = Math.random();',
    'const value = process.env.FLAG;',
    "import fs from 'node:fs';",
  ]) assert(inspectPolicyPurity('test.policy.ts', source).length, source);
  assert.deepEqual(inspectPolicyPurity('test.policy.ts',
    'function decide(until: Date, nowMs: number) { return until.getTime() > nowMs; }'), []);
});

test('includes bounded-context module wiring in cycle detection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-module-cycles-'));
  try {
    for (const [source, target] of [['room', 'bot'], ['bot', 'room']]) {
      fs.mkdirSync(path.join(root, 'modules', source, 'module'), { recursive: true });
      fs.writeFileSync(path.join(root, 'modules', source, 'public-api.ts'), 'export const Module = true;');
      fs.writeFileSync(path.join(root, 'modules', source, 'module', 'wiring.ts'),
        `import { Module } from '../../${target}/public-api'; export const imports = [Module];`);
    }
    const analysis = analyzeArchitecture({ root, contract });
    assert.ok(analysis.violations.some(v => v.rule === 'component-cycle'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('keeps ORM and validation framework APIs outside domain and application contracts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-domain-boundaries-'));
  try {
    for (const layer of ['domain', 'application']) {
      fs.mkdirSync(path.join(root, 'modules/user', layer), { recursive: true });
      fs.writeFileSync(path.join(root, 'modules/user', layer, 'model.ts'), "import { Entity, EntityManager, QueryBuilder } from 'typeorm';\nvoid [Entity, EntityManager, QueryBuilder];");
    }
    fs.writeFileSync(path.join(root, 'modules/user/domain/validation.ts'), "import Joi from 'joi';\nimport { z } from 'zod';\nimport { IsString } from 'class-validator';\nvoid [Joi, z, IsString];");
    const analysis = analyzeArchitecture({ root, contract });
    assert.equal(analysis.violations.filter(v => v.rule === 'domain-no-typeorm').length, 1);
    assert.equal(analysis.violations.filter(v => v.rule === 'application-no-typeorm').length, 1);
    assert.equal(analysis.violations.filter(v => v.rule === 'domain-no-validation-framework').length, 3);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('forbids declared storage dependencies even in module composition', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-notification-'));
  try {
    for (const { source: pattern, target } of contract.dependencies.forbidden) {
      const source = pattern === '*' ? 'room' : pattern;
      fs.mkdirSync(path.join(root, 'modules', source, 'module'), { recursive: true });
      fs.mkdirSync(path.join(root, 'modules', target), { recursive: true });
      fs.writeFileSync(path.join(root, 'modules', target, 'public-api.ts'), 'export const reader = true;');
      fs.writeFileSync(path.join(root, 'modules', source, 'module', `${target}.ts`),
        `import { reader } from '../../${target}/public-api';\nvoid reader;`);
    }
    const analysis = analyzeArchitecture({ root, contract });
    assert.equal(analysis.violations.filter((entry) =>
      entry.rule === 'forbidden-component-dependency').length, contract.dependencies.forbidden.length);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('recognizes nested game components and their application layer', () => {
  const relative =
    'game/games/vents-sacres/morpion/application/services/morpion.service.ts';
  const component = describeComponent(relative, contract);
  assert.equal(component.name, 'game.games.vents-sacres.morpion');
  assert.equal(detectLayer(relative, component, contract), 'application');
});

test('maps model and rulebook folders to the domain layer', () => {
  for (const folder of ['model', 'rulebook']) {
    const relative = `game/games/vents-sacres/morpion/${folder}/state.ts`;
    const component = describeComponent(relative, contract);
    assert.equal(detectLayer(relative, component, contract), 'domain');
  }
});

test('treats files at the src root as composition files', () => {
  const component = describeComponent('main.ts', contract);
  assert.equal(component.name, 'root');
  assert.equal(component.kind, 'composition');
  assert.equal(
    isCompositionSource(
      { relative: 'main.ts', component, layer: null },
      contract,
    ),
    true,
  );
});

test('compares semantic counts so moving a file is not a regression', () => {
  const base = {
    rule: 'cross-component-deep-import',
    source: 'room',
    target: 'platform.redis',
    subject: null,
  };
  const baseline = groupViolations([
    { ...base, file: 'modules/room/old.ts', detail: 'imports platform/redis/old.ts' },
  ]);
  const current = groupViolations([
    { ...base, file: 'modules/room/new.ts', detail: 'imports platform/redis/new.ts' },
  ]);
  assert.deepEqual(compareGroups(current, baseline).regressions, []);
});

test('deduplicates graph cycles into one strongly connected component', () => {
  const graph = new Map([
    ['room', new Set(['game'])],
    ['game', new Set(['stats'])],
    ['stats', new Set(['room'])],
  ]);
  assert.deepEqual(detectStronglyConnectedComponents(graph), [
    ['game', 'room', 'stats'],
  ]);
});

test('keeps public API dependencies in the component graph model', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-architecture-'));
  try {
    fs.mkdirSync(path.join(root, 'modules', 'room', 'application'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, 'shared', 'utils'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'modules', 'room', 'application', 'service.ts'),
      "import { helper } from '../../../shared/utils/public-api';\nvoid helper;\n",
    );
    fs.writeFileSync(
      path.join(root, 'shared', 'utils', 'public-api.ts'),
      'export const helper = true;\n',
    );

    const analysis = analyzeArchitecture({ root, contract });
    assert.equal(analysis.graph.get('room').has('shared'), true);
    assert.equal(
      analysis.violations.some(
        (entry) => entry.rule === 'cross-component-deep-import',
      ),
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('allows only component dependencies declared by the contract', () => {
  assert.equal(
    isAllowedDependency(
      { name: 'room' },
      { name: 'platform.redis' },
      contract,
    ),
    true,
  );
  assert.equal(
    isAllowedDependency({ name: 'user' }, { name: 'vault' }, contract),
    false,
  );
});

test('reports an undeclared dependency even when it uses a public API', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-architecture-'));
  try {
    fs.mkdirSync(path.join(root, 'modules', 'user', 'application'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, 'modules', 'vault'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'modules', 'user', 'application', 'service.ts'),
      "import { vaultApi } from '../../vault/public-api';\nvoid vaultApi;\n",
    );
    fs.writeFileSync(
      path.join(root, 'modules', 'vault', 'public-api.ts'),
      'export const vaultApi = true;\n',
    );

    const analysis = analyzeArchitecture({ root, contract });
    assert.equal(
      analysis.violations.some(
        (entry) => entry.rule === 'unapproved-component-dependency',
      ),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects foreign storage imports in composition as well as repositories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-architecture-'));
  try {
    const entityDir = path.join(
      root,
      'modules',
      'vault',
      'infrastructure',
      'persistence',
      'typeorm',
      'entities',
    );
    fs.mkdirSync(path.join(root, 'modules', 'room', 'module'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, 'modules', 'room', 'infrastructure', 'persistence'), {
      recursive: true,
    });
    fs.mkdirSync(entityDir, { recursive: true });
    fs.writeFileSync(
      path.join(entityDir, 'snapshot.entity.ts'),
      'export class SnapshotEntity {}\n',
    );
    fs.writeFileSync(
      path.join(root, 'modules', 'room', 'module', 'room.module.ts'),
      "import { SnapshotEntity } from '../../vault/infrastructure/persistence/typeorm/entities/snapshot.entity';\nvoid SnapshotEntity;\n",
    );
    fs.writeFileSync(
      path.join(root, 'modules', 'room', 'infrastructure', 'persistence', 'repository.ts'),
      "import { SnapshotEntity } from '../../../vault/infrastructure/persistence/typeorm/entities/snapshot.entity';\nvoid SnapshotEntity;\n",
    );

    const analysis = analyzeArchitecture({ root, contract });
    const entityViolations = analysis.violations.filter(
      (entry) => entry.rule === 'cross-component-typeorm-entity',
    );
    const deepImportViolations = analysis.violations.filter(
      (entry) => entry.rule === 'cross-component-deep-import',
    );
    assert.equal(entityViolations.length, 1);
    assert.equal(entityViolations[0].file.endsWith('repository.ts'), true);
    assert.equal(deepImportViolations.length, 2);
    assert.ok(deepImportViolations.some((entry) => entry.file.endsWith('room.module.ts')));
    assert.ok(deepImportViolations.some((entry) => entry.file.endsWith('repository.ts')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects private imports across business modules', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-architecture-'));
  try {
    fs.mkdirSync(path.join(root, 'modules', 'user', 'application'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, 'modules', 'vault', 'domain'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, 'modules', 'user', 'application', 'service.ts'),
      "import { secret } from '../../vault/domain/secret';\nvoid secret;\n",
    );
    fs.writeFileSync(
      path.join(root, 'modules', 'vault', 'domain', 'secret.ts'),
      'export const secret = true;\n',
    );

    const analysis = analyzeArchitecture({ root, contract });
    assert.equal(
      analysis.violations.some(
        (entry) => entry.rule === 'cross-component-deep-import',
      ),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects shared depending on business code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-architecture-'));
  try {
    fs.mkdirSync(path.join(root, 'shared', 'utils'), { recursive: true });
    fs.mkdirSync(path.join(root, 'modules', 'user'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'shared', 'utils', 'helper.ts'),
      "import { userApi } from '../../modules/user/public-api';\nvoid userApi;\n",
    );
    fs.writeFileSync(
      path.join(root, 'modules', 'user', 'public-api.ts'),
      'export const userApi = true;\n',
    );

    const analysis = analyzeArchitecture({ root, contract });
    assert.equal(
      analysis.violations.some(
        (entry) => entry.rule === 'shared-dependency-direction',
      ),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects platform depending on business code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-architecture-'));
  try {
    fs.mkdirSync(path.join(root, 'platform', 'redis', 'application'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, 'modules', 'user'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'platform', 'redis', 'application', 'adapter.ts'),
      "import { userApi } from '../../../modules/user/public-api';\nvoid userApi;\n",
    );
    fs.writeFileSync(
      path.join(root, 'modules', 'user', 'public-api.ts'),
      'export const userApi = true;\n',
    );

    const analysis = analyzeArchitecture({ root, contract });
    assert.equal(
      analysis.violations.some(
        (entry) => entry.rule === 'platform-dependency-direction',
      ),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reports a real cycle between components', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-architecture-'));
  try {
    fs.mkdirSync(path.join(root, 'modules', 'user'), { recursive: true });
    fs.mkdirSync(path.join(root, 'modules', 'vault'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'modules', 'user', 'public-api.ts'),
      "import { vaultApi } from '../vault/public-api';\nexport const userApi = vaultApi;\n",
    );
    fs.writeFileSync(
      path.join(root, 'modules', 'vault', 'public-api.ts'),
      "import { userApi } from '../user/public-api';\nexport const vaultApi = userApi;\n",
    );

    const analysis = analyzeArchitecture({ root, contract });
    assert.equal(
      analysis.violations.some((entry) => entry.rule === 'component-cycle'),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('keeps the complete modules, game, platform and shared graph clean', () => {
  const analysis = analyzeArchitecture();
  assert.deepEqual(groupViolations(analysis.violations), []);
  for (const component of ['user', 'game', 'platform.database', 'shared.utils']) {
    assert.equal(analysis.components.has(component), true);
  }
});
