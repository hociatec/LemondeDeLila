'use strict';
const ts = require('typescript');

function inspectPolicyPurity(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations = new Set();
  function visit(node) {
    if (ts.isAwaitExpression(node) || ts.isFunctionTypeNode(node))
      violations.add('Une policy reçoit des données, sans attente ni callback de service.');
    if (ts.isConstructorDeclaration(node) && node.parameters.length)
      violations.add('Passer les données aux décisions, sans injecter de service dans une policy.');
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly &&
      /^(?:node:|fs$|fs\/|typeorm$|@nestjs\/typeorm)|\/(?:infrastructure|ports|config)\//.test(node.moduleSpecifier.text))
      violations.add('Les lectures techniques appartiennent aux appelants de la policy.');
    if (ts.isCallExpression(node) &&
      /^(?:Date\.now|Math\.random|readEnvironment|setTimeout|setInterval)$/.test(node.expression.getText(ast)))
      violations.add('Fournir explicitement le temps, le hasard et la configuration.');
    if (ts.isNewExpression(node) && node.expression.getText(ast) === 'Date' && !node.arguments?.length)
      violations.add('Fournir explicitement le temps, le hasard et la configuration.');
    if (ts.isPropertyAccessExpression(node) && node.getText(ast) === 'process.env')
      violations.add('Fournir explicitement le temps, le hasard et la configuration.');
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...violations];
}

module.exports = { inspectPolicyPurity };
