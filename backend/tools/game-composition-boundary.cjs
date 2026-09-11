'use strict';
const ts = require('typescript');

const ruleBuilders = new Set(['defineAction', 'defineChoice', 'defineEffect', 'when', 'victoryWhen']);
const executionKeys = new Set(['ctx', 'context', 'state', 'actor', 'players', 'input', 'config', 'availableActions', 'legalActions', 'actorPlayerId', 'targetPlayerIds']);

function inspectGameComposition(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const importedRules = new Set();
  const importedBuilders = new Set();
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings)) continue;
    for (const binding of node.importClause.namedBindings.elements) {
      if (node.moduleSpecifier.text.startsWith('./')) importedRules.add(binding.name.text);
      if (node.moduleSpecifier.text.endsWith('/engine/sdk/public-api') && ruleBuilders.has((binding.propertyName ?? binding.name).text)) importedBuilders.add(binding.name.text);
    }
  }
  const violations = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && importedBuilders.has(node.expression.text))
      violations.push('Déclarer les règles exécutables dans les fichiers de règles, puis les composer dans game.ts.');
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) && node.body) {
      const execution = node.parameters.some(parameter => {
        if (ts.isIdentifier(parameter.name)) return executionKeys.has(parameter.name.text);
        return ts.isObjectBindingPattern(parameter.name) && parameter.name.elements.some(binding => executionKeys.has((binding.propertyName ?? binding.name).getText(ast)));
      });
      if (execution && !isDelegation(node.body, importedRules))
        violations.push('Une fonction utilisant le contexte de partie doit appartenir aux règles ; game.ts peut seulement déléguer.');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...new Set(violations)];
}

function isDelegation(body, importedRules) {
  if (ts.isBlock(body)) {
    if (body.statements.length !== 1 || !ts.isReturnStatement(body.statements[0]) || !body.statements[0].expression) return false;
    body = body.statements[0].expression;
  }
  return ts.isCallExpression(body) && ts.isIdentifier(body.expression) && importedRules.has(body.expression.text) && body.arguments.every(argument => isArgument(argument));
}

function isArgument(node) {
  if (ts.isIdentifier(node) || ts.isLiteralExpression(node) || node.kind === ts.SyntaxKind.NullKeyword || node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return true;
  return ts.isPropertyAccessExpression(node) && isArgument(node.expression);
}

function inspectRuleContracts(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const localTypes = new Set();
  for (const node of ast.statements) {
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) localTypes.add(node.name.text);
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const binding of node.importClause.namedBindings.elements) {
        if (node.importClause.isTypeOnly || binding.isTypeOnly) localTypes.add(binding.name.text);
      }
    }
  }
  return ast.statements.some(node =>
    ((ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
      node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) ||
    (ts.isExportDeclaration(node) && (node.isTypeOnly ||
      (node.exportClause && ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.some(element => element.isTypeOnly ||
          (!node.moduleSpecifier && localTypes.has((element.propertyName ?? element.name).text))))))
  ) ? ['Les contrats de données exportés appartiennent à types.ts ou state.ts.'] : [];
}

module.exports = { inspectGameComposition, inspectRuleContracts };
