'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function inspectBoundary(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations = [];
  const normalized = file.replaceAll('\\', '/');
  function inspect(node) {
    if (!ts.isStringLiteral(node)) return;
    const parent = node.parent;
    if (!(
      ts.isImportDeclaration(parent) ||
      ts.isExportDeclaration(parent) ||
      ts.isLiteralTypeNode(parent) ||
      (ts.isCallExpression(parent) &&
        (parent.expression.kind === ts.SyntaxKind.ImportKeyword ||
          parent.expression.getText(tree) === 'require'))
    ))
      return;
    const target = node.text.startsWith('.')
      ? path.posix.normalize(
          path.posix.join(path.posix.dirname(normalized), node.text),
        )
      : node.text.replace(/^@game\//, 'src/game/');
    const reject = (reason) =>
      violations.push(`${normalized}: ${reason}: ${node.text}`);
    if (
      normalized.endsWith('/engine/sdk/extension-contracts.ts') &&
      !(
        ts.isExportDeclaration(parent) &&
        parent.isTypeOnly &&
        target.includes('/engine/runtime/contracts/')
      )
    )
      reject('extension contracts must only re-export low-level types');
    if (
      normalized.includes('/rules/recipes/') &&
      target.includes('/rules/game-specific/')
    )
      reject('generic recipes cannot depend on game-specific packs');
    if (
      /\/rules\/(game-specific|recipes)\//.test(normalized) &&
      !normalized.endsWith('.spec.ts') &&
      target.includes('/engine/runtime/')
    )
      reject('use the reviewed extension API');
    if (normalized.includes('/engine/sdk/') && target.includes('/core/'))
      reject('the engine SDK cannot depend on its application host');
    if (
      normalized.includes('/engine/runtime/') &&
      normalized.endsWith('.spec.ts') &&
      target.includes('/rules/')
    )
      reject('catalogue integration tests belong in game/testing');
  }
  function visit(node) {
    if (
      !normalized.endsWith('.spec.ts') &&
      /\/game\/(?:rules\/|engine\/runtime\/(?:definitions|content|contracts)\/)/.test(
        normalized,
      ) &&
      ts.isThrowStatement(node) &&
      ts.isNewExpression(node.expression) &&
      node.expression.expression.getText(tree) === 'Error'
    )
      violations.push(
        `${normalized}: authoring paths require typed errors with semantic origins`,
      );
    inspect(node);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return violations;
}

function audit(root = path.resolve(__dirname, '..')) {
  const walk = (directory) =>
    fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      );
  const violations = walk(path.join(root, 'src/game'))
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) =>
      inspectBoundary(path.relative(root, file), fs.readFileSync(file, 'utf8')),
    );
  if (violations.length) throw new Error(violations.join('\n'));
  console.log('Extension API boundaries: OK');
}
module.exports = { inspectBoundary, audit };
if (require.main === module) audit();
