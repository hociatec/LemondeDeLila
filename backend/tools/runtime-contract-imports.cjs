'use strict';
const ts = require('typescript');

function hasHigherLayerValueImport(source) {
  const ast = ts.createSourceFile(
    'contract.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  return ast.statements.some((node) => {
    if (
      (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) ||
      !node.moduleSpecifier ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      !node.moduleSpecifier.text.startsWith('../')
    )
      return false;
    if (ts.isExportDeclaration(node))
      return (
        !node.isTypeOnly &&
        (!node.exportClause ||
          !ts.isNamedExports(node.exportClause) ||
          node.exportClause.elements.some((element) => !element.isTypeOnly))
      );
    const clause = node.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (
      clause.name ||
      !clause.namedBindings ||
      ts.isNamespaceImport(clause.namedBindings)
    )
      return true;
    return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
  });
}
module.exports = { hasHigherLayerValueImport };
