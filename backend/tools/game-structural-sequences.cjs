'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const capabilities = new Set([
  'cards', 'choice', 'movement', 'pawns', 'inventory', 'ownership', 'resources',
  'score', 'status', 'turn', 'round', 'match', 'dice', 'submissions', 'voting',
  'counters', 'phase', 'quiz', 'effects', 'ranking',
]);
const isFunction = node => ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) || ts.isMethodDeclaration(node);

function memberPath(node) {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) return [...memberPath(node.expression), node.name.text];
  return [];
}

/** Preserve call order and control-flow branches, ignoring local names and literal data. */
function operations(body, source) {
  const result = [];
  function visit(node, branch = '') {
    if (isFunction(node)) return; // Each callback is inspected independently.
    if (ts.isIfStatement(node)) {
      visit(node.expression, `${branch}/if.condition`);
      visit(node.thenStatement, `${branch}/if.then`);
      if (node.elseStatement) visit(node.elseStatement, `${branch}/if.else`);
      return;
    }
    if (ts.isConditionalExpression(node)) {
      visit(node.condition, `${branch}/conditional.condition`);
      visit(node.whenTrue, `${branch}/conditional.then`);
      visit(node.whenFalse, `${branch}/conditional.else`);
      return;
    }
    const nested = ts.isForStatement(node) || ts.isForOfStatement(node) ||
      ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)
      ? `${branch}/loop` : ts.isCaseClause(node) || ts.isDefaultClause(node)
        ? `${branch}/switch.branch` : branch;
    ts.forEachChild(node, child => visit(child, nested));
    if (!ts.isCallExpression(node)) return;
    const parts = memberPath(node.expression);
    if (parts.length !== 3 || !capabilities.has(parts[1])) return;
    result.push({ operation: `${nested || '/straight'}:${parts.slice(1).join('.')}`,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
  }
  visit(body);
  return result;
}

function inspectSources(sources) {
  const groups = new Map();
  let functions = 0;
  for (const { file, game, source } of sources) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (tree.parseDiagnostics.length) throw new Error(`Cannot audit invalid TypeScript: ${file}`);
    function inspect(node) {
      if (isFunction(node) && node.body) {
        functions += 1;
        const calls = operations(node.body, tree);
        for (let width = 3; width <= Math.min(6, calls.length); width += 1) {
          for (let index = 0; index + width <= calls.length; index += 1) {
            const window = calls.slice(index, index + width);
            const sequence = window.map(call => call.operation);
            if (new Set(sequence).size < 2) continue;
            const key = JSON.stringify(sequence);
            const group = groups.get(key) ?? { sequence, occurrences: [] };
            group.occurrences.push({ game, file, line: window[0].line,
              functionLine: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 });
            groups.set(key, group);
          }
        }
      }
      ts.forEachChild(node, inspect);
    }
    inspect(tree);
  }
  const candidates = [...groups.values()]
    .map(group => ({ ...group, games: [...new Set(group.occurrences.map(item => item.game))].sort() }))
    .filter(group => group.games.length >= 2)
    .sort((left, right) => right.sequence.length - left.sequence.length ||
      right.games.length - left.games.length || JSON.stringify(left.sequence).localeCompare(JSON.stringify(right.sequence), 'en'));
  return { files: sources.length, functions, games: [...new Set(sources.map(item => item.game))].sort(), candidates };
}

function inspectRepository(root) {
  const sources = [];
  function walk(directory, game) {
    if (fs.existsSync(path.join(directory, 'manifest.json'))) game = path.basename(directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target, game);
      else if (entry.name.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(entry.name)) {
        const owner = game ?? entry.name.replace(/(?:\.recipes)?\.ts$/, '');
        sources.push({ game: owner, file: path.relative(root, target).replaceAll('\\', '/'), source: fs.readFileSync(target, 'utf8') });
      }
    }
  }
  walk(root, null);
  return inspectSources(sources);
}

if (require.main === module) {
  const report = inspectRepository(
    path.resolve(__dirname, '../src/game/engine/runtime/recipes'),
  );
  console.log(JSON.stringify(report, null, 2));
}
module.exports = { inspectSources, inspectRepository };
