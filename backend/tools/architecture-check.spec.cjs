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

test('lets composition modules wire another component entity without opening repositories', () => {
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
    assert.equal(deepImportViolations.length, 1);
    assert.equal(deepImportViolations[0].file.endsWith('repository.ts'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
