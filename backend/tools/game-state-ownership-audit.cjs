#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const BACKEND = path.resolve(__dirname, '..');
const RUNTIME = path.join(BACKEND, 'src/game/engine/runtime');
const ALLOWED_PROCESS_CACHES = new Set([
  'content/content-immutability.ts:immutableCollections:WeakSet',
  'definitions/compiled-game-definition-brand.ts:compiledDefinitions:WeakSet',
  'definitions/game-definition-compiler.ts:compiledDefinitions:WeakMap',
  'events/engine-event-registry.ts:ENGINE_EVENT_TYPES:Set',
]);

function productionFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(absolute);
    return absolute.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(absolute)
      ? [absolute]
      : [];
  });
}

function inspectTopLevelMutableState(runtime = RUNTIME, allow = ALLOWED_PROCESS_CACHES) {
  const violations = [];
  for (const file of productionFiles(runtime)) {
    const source = fs.readFileSync(file, 'utf8');
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const statement of tree.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      const isConst = Boolean(statement.declarationList.flags & ts.NodeFlags.Const);
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText(tree);
        if (!isConst) {
          violations.push(`${path.relative(runtime, file)}:${name}: top-level let/var`);
          continue;
        }
        const initializer = declaration.initializer;
        if (!initializer || !ts.isNewExpression(initializer)) continue;
        const collection = initializer.expression.getText(tree);
        if (!['Map', 'Set', 'WeakMap', 'WeakSet'].includes(collection)) continue;
        const relative = path.relative(runtime, file).replaceAll(path.sep, '/');
        const key = `${relative}:${name}:${collection}`;
        if (!allow.has(key))
          violations.push(`${relative}:${name}: unreviewed process collection ${collection}`);
      }
    }
  }
  return violations;
}

function auditFactory() {
  const file = path.join(RUNTIME, 'state/declarative-state.factory.ts');
  const source = fs.readFileSync(file, 'utf8');
  const required = [
    'structuredClone(base)',
    'structuredClone(base.players ?? [])',
    'structuredClone(turn)',
    'createMatchKitState(',
    'createRoundKitState()',
    'createPlayerValuesKitState()',
    'createGameConfigurationState(',
    'createEffectEngineState()',
    'createGameCommandJournalState()',
    'createSubmissionKitState()',
    'createGameSchedulerState()',
  ];
  return required
    .filter((proof) => !source.includes(proof))
    .map((proof) => `declarative-state.factory.ts: missing fresh-state proof ${proof}`);
}

function main() {
  const violations = [...inspectTopLevelMutableState(), ...auditFactory()];
  if (violations.length) throw new Error(violations.join('\n'));
  console.log(
    `game-state-ownership-audit: OK (${productionFiles(RUNTIME).length} runtime production files, 4 reviewed immutable registries/caches)`,
  );
}

if (require.main === module) main();

module.exports = { inspectTopLevelMutableState };
