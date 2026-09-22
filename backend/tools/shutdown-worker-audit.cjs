'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function inspect(source, file = 'worker.ts') {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const workers = new Set();
  const namespaces = new Set();
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || node.moduleSpecifier.text !== 'bullmq') continue;
    const imports = node.importClause?.namedBindings;
    if (imports && ts.isNamedImports(imports)) {
      for (const item of imports.elements)
        if ((item.propertyName ?? item.name).text === 'Worker') workers.add(item.name.text);
    } else if (imports && ts.isNamespaceImport(imports)) namespaces.add(imports.name.text);
  }
  const isMember = (node, name) => node && ts.isPropertyAccessExpression(node) && node.name.text === name;
  const isShutdownCall = (node, method) => node && ts.isCallExpression(node) &&
    isMember(node.expression, method) && (isMember(node.expression.expression, 'shutdown') ||
      ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'shutdown');
  const violations = [];
  let sources = 0;
  function visit(node) {
    if (isShutdownCall(node, 'registerSource')) sources++;
    if (ts.isNewExpression(node)) {
      const target = node.expression;
      const worker = ts.isIdentifier(target) && workers.has(target.text) ||
        isMember(target, 'Worker') && ts.isIdentifier(target.expression) && namespaces.has(target.expression.text);
      if (worker) {
        const processor = node.arguments?.[1];
        const body = processor && (ts.isArrowFunction(processor) || ts.isFunctionExpression(processor)) ? processor.body : null;
        const expression = body && ts.isBlock(body) && body.statements.length === 1 && ts.isReturnStatement(body.statements[0])
          ? body.statements[0].expression : body;
        if (!isShutdownCall(expression, 'run') || expression.arguments.length !== 1) {
          violations.push(`${file}: BullMQ processor must return shutdown.run(operation) with normal admission`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if ((workers.size || namespaces.size) && sources === 0)
    violations.push(`${file}: BullMQ worker must register a shutdown source`);
  return violations;
}

function audit(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? audit(file) : file.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(file)
      ? inspect(fs.readFileSync(file, 'utf8'), file) : [];
  });
}
if (require.main === module) {
  const violations = audit(path.resolve(__dirname, '../src'));
  if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1; }
  else console.log('shutdown-worker-audit: OK');
}
module.exports = { inspect };
