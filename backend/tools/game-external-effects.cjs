'use strict';
const ts = require('typescript');
const path = require('node:path');

const forbidden = new Set([
  'fetch', 'WebSocket', 'XMLHttpRequest', 'EventSource',
  'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask',
  'process', 'globalThis', 'global', 'window', 'self', 'navigator',
  'eval', 'Function', 'Promise',
]);

/** Rule modules have synchronous SDK capabilities; external work belongs after commit. */
function inspectGameExternalEffects(file, source) {
  if (/\.(?:spec|test)\.ts$/.test(file)) return [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const options = { noLib: true, noResolve: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => path.resolve(name) === path.resolve(file) ? ast : undefined;
  const checker = ts.createProgram([file], options, host).getTypeChecker();
  const violations = [];
  function visit(node) {
    if (ts.isAwaitExpression(node) || node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      violations.push(`Ligne ${line}: règle asynchrone interdite avant commit.`);
    }
    if (ts.isIdentifier(node) && forbidden.has(node.text) && isReference(node) && !locallyBound(node)) {
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      violations.push(`Ligne ${line}: capacité externe ${node.text} interdite dans les règles.`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return violations;

  function locallyBound(node) {
    const symbol = checker.getSymbolAtLocation(node);
    return symbol && (symbol.valueDeclaration?.getSourceFile() === ast ||
      ((symbol.flags & ts.SymbolFlags.Alias) && symbol.declarations?.some((declaration) => declaration.getSourceFile() === ast)));
  }
}

function isReference(node) {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if ((ts.isPropertySignature(parent) || ts.isMethodSignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) return false;
  return true;
}

module.exports = { inspectGameExternalEffects };
