'use strict';
const ts = require('typescript');

const writes = new Set(['save', 'insert', 'update', 'upsert', 'delete', 'remove',
  'softDelete', 'softRemove', 'restore', 'increment', 'decrement', 'writeFile',
  'writeFileSync', 'appendFile', 'appendFileSync', 'unlink', 'unlinkSync',
  'rename', 'renameSync', 'rm', 'rmSync']);

function inspectReaderBoundary(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations = new Set();
  function visit(node) {
    if ((ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) &&
        ts.isIdentifier(node.name) && writes.has(node.name.text))
      violations.add('Le contrat public d’un Reader ne doit pas exposer de commande.');
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        writes.has(node.expression.name.text))
      violations.add('Un Reader lit et projette ; les écritures appartiennent aux commandes.');
    if (ts.isStringLiteralLike(node) && /^\s*(?:(?:INSERT|REPLACE)\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|(?:ALTER|DROP|TRUNCATE)\s+TABLE)\s/i.test(node.text))
      violations.add('Une requête de Reader ne doit pas modifier les données.');
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...violations];
}

module.exports = { inspectReaderBoundary };
