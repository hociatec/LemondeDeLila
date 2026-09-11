'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const {analyzeRuntime} = require('./runtime-dependency-graph.cjs');

function fixture(files, check) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-runtime-graph-'));
  try {
    for (const [name, source] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), source);
    check(analyzeRuntime(directory));
  } finally {
    assert.equal(path.dirname(fs.realpathSync(directory)), fs.realpathSync(os.tmpdir()));
    fs.rmSync(directory, {recursive: true, force: true});
  }
}

test('type-only imports and re-export barrels cannot hide a runtime cycle', () => {
  fixture({
    'a.ts': "import type {B} from './public-api'; export type A = {b: B};",
    'b.ts': "export type B = {a: import('./a').A};",
    'public-api.ts': "export type {B} from './b';",
  }, result => assert.deepEqual(result.cycles, [['a.ts', 'b.ts', 'public-api.ts']]));
});

test('aliases and dynamic imports count as dependencies', () => {
  fixture({
    'tsconfig.json': JSON.stringify({compilerOptions: {baseUrl: '.', paths: {'@local/*': ['./*']}}}),
    'a.ts': "export const load = () => import('@local/b');",
    'b.ts': "export {load} from './a';",
  }, result => assert.deepEqual(result.cycles, [['a.ts', 'b.ts']]));
});

test('independent contracts keep the dependency graph acyclic', () => {
  fixture({
    'contracts.ts': 'export interface State { value: number }',
    'runtime.ts': "import type {State} from './contracts'; export const run = (s: State) => s.value;",
    'author.ts': "import type {State} from './contracts'; export const initial: State = {value: 1};",
  }, result => assert.deepEqual(result.cycles, []));
});

test('CommonJS require and TypeScript import-equals cannot hide cycles', () => {
  fixture({
    'a.ts': "const b = require('./b'); export const a = b;",
    'b.ts': "import a = require('./a'); export const b = a;",
  }, result => assert.deepEqual(result.cycles, [['a.ts', 'b.ts']]));
});

test('CommonJS cannot hide a compiler dependency behind a runtime bridge', () => {
  fixture({
    'game-rule-context.ts': "const bridge = require('./bridge');",
    'bridge.ts': "import compiler = require('./game-definition-compiler');",
    'game-definition-compiler.ts': 'export const compile = () => {};',
  }, result => assert.deepEqual(result.compilerDependencies,
    [['game-rule-context.ts', 'bridge.ts', 'game-definition-compiler.ts']]));
});

test('the production runtime has no dependency cycles, including types', () => {
  const result = analyzeRuntime(path.join(__dirname, '../src/game/engine/runtime'));
  assert(result.files > 100);
  assert.deepEqual(result.cycles, []);
  assert.deepEqual(result.compilerDependencies, []);
});

test('the neutral compiled plan has no imports from authoring or execution', () => {
  const ts = require('typescript');
  const file = path.join(__dirname, '../src/game/engine/runtime/contracts/compiled-game-plan.ts');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const dependencies = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isImportTypeNode(node) ||
        (ts.isExportDeclaration(node) && node.moduleSpecifier)) dependencies.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.deepEqual(dependencies, []);
});

test('an indirect compiler dependency is rejected even without a cycle', () => {
  fixture({
    'game-rule-context.ts': "export {compile} from './bridge';",
    'bridge.ts': "export {compile} from './game-definition-compiler';",
    'game-definition-compiler.ts': 'export const compile = () => {};',
  }, result => {
    assert.deepEqual(result.cycles, []);
    assert.deepEqual(result.compilerDependencies, [['game-rule-context.ts', 'bridge.ts', 'game-definition-compiler.ts']]);
  });
});
