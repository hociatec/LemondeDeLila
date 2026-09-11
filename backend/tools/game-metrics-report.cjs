'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { inspectDuplicates } = require('./game-duplication-check.cjs');

const repo = path.resolve(__dirname, '..');
function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function category(file) {
  const name = path.basename(file);
  if (name === 'game.ts' || name === 'game.json' || name === 'configuration.ts')
    return 'declarativeLoc';
  if (
    /content|constants/.test(name) ||
    file.endsWith('.json') ||
    file.endsWith('.txt')
  )
    return 'contentLoc';
  return 'customRulesLoc';
}

function inspectFunctions(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const functions = [];
  function visit(node) {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      node.body
    ) {
      const calls = [];
      function collect(child) {
        // A nested callback belongs to its own sequence, not the caller's path.
        if (
          child !== node.body &&
          (ts.isArrowFunction(child) || ts.isFunctionExpression(child))
        )
          return;
        if (ts.isCallExpression(child))
          calls.push(child.expression.getText(ast));
        ts.forEachChild(child, collect);
      }
      collect(node.body);
      functions.push({
        name:
          node.name?.getText(ast) ??
          node.parent?.name?.getText(ast) ??
          '<callback>',
        line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
        lines:
          ast.getLineAndCharacterOfPosition(node.end).line -
          ast.getLineAndCharacterOfPosition(node.getStart(ast)).line +
          1,
        calls,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return functions;
}

function measureGames(root) {
  return walk(root)
    .filter((file) => path.basename(file) === 'manifest.json')
    .map((manifest) => {
      const directory = path.dirname(manifest);
      const game = {
        gameId: path.basename(directory),
        contentLoc: 0,
        declarativeLoc: 0,
        customRulesLoc: 0,
        files: [],
      };
      for (const file of walk(directory).filter(
        (file) =>
          /\.(ts|json|txt)$/.test(file) &&
          !/\.(spec|test)\.ts$/.test(file) &&
          path.basename(file) !== 'manifest.json',
      )) {
        const source = fs.readFileSync(file, 'utf8');
        const loc = source
          .split(/\r?\n/)
          .filter(
            (line) => line.trim() && !line.trim().startsWith('//'),
          ).length;
        const kind = category(file);
        game[kind] += loc;
        game.files.push({
          file: path.relative(repo, file).replaceAll('\\', '/'),
          category: kind,
          loc,
          functions: file.endsWith('.ts') ? inspectFunctions(file, source) : [],
        });
      }
      const logicLoc = game.declarativeLoc + game.customRulesLoc;
      return {
        ...game,
        declarativeShare: logicLoc === 0 ? null : game.declarativeLoc / logicLoc,
      };
    })
    .sort((a, b) => (a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0));
}

function growthReviews(current, previous) {
  const reviews = [];
  for (const game of current) {
    const before = previous.find((entry) => entry.gameId === game.gameId);
    if (!before) {
      reviews.push({ gameId: game.gameId, reason: 'new-game' });
      continue;
    }
    for (const metric of ['declarativeLoc', 'customRulesLoc']) {
      const delta = game[metric] - before[metric];
      if (delta >= 100 && game[metric] >= before[metric] * 1.2)
        reviews.push({
          gameId: game.gameId,
          metric,
          before: before[metric],
          after: game[metric],
          delta,
        });
    }
  }
  return reviews;
}

function main() {
  const root = path.join(repo, 'src/game/games');
  const games = measureGames(root);
  const compareIndex = process.argv.indexOf('--compare');
  const previous =
    compareIndex >= 0
      ? JSON.parse(fs.readFileSync(process.argv[compareIndex + 1], 'utf8'))
          .games
      : [];
  const report = {
    schemaVersion: 1,
    methodology:
      'Non-empty lines excluding // comments; game.json, game.ts and configuration.ts count as declarative. declarativeShare = declarativeLoc / (declarativeLoc + customRulesLoc), excluding content assets; this is a filename-based indicator, not semantic proof. Call sequences are lexical review aids, not execution traces. Types and helper files count as custom code.',
    games,
    growthReviews: compareIndex >= 0 ? growthReviews(games, previous) : [],
    structuralDuplicates: inspectDuplicates(root),
  };
  fs.writeFileSync(
    path.join(__dirname, 'game-metrics-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `game-metrics: ${games.length} jeux; ${report.growthReviews.length} revues de croissance; ${report.structuralDuplicates.length} groupes de duplication`,
  );
}

module.exports = { measureGames, growthReviews, inspectFunctions };
if (require.main === module) main();
