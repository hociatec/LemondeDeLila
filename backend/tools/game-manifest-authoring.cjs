const ts = require('typescript');

function inspectManifestAuthoring(source, manifestId) {
  const ast = ts.createSourceFile('game.ts', source, ts.ScriptTarget.Latest, true);
  const imported = ast.statements.find(statement => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === './manifest.json' && !statement.importClause?.isTypeOnly);
  const binding = imported?.importClause?.name?.text;
  const exported = ast.statements.find(ts.isExportAssignment);
  const call = exported?.expression;
  const definition = call && ts.isCallExpression(call) ? call.arguments[0] : undefined;
  function properties(node) {
    if (!node || !ts.isObjectLiteralExpression(node)) return new Map();
    return new Map(node.properties.filter(ts.isPropertyAssignment).map(property => [property.name.text, property.initializer]));
  }
  function fromManifest(node, field) {
    return !!binding && !!node && ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === binding && node.name.text === field;
  }
  const fields = properties(definition);
  const players = properties(fields.get('players'));
  const id = fields.get('id');
  return {
    declaredId: fromManifest(id, 'code') ? manifestId : id && ts.isStringLiteral(id) ? id.text : undefined,
    canonical: fromManifest(id, 'code') && fromManifest(fields.get('displayName'), 'name') && fromManifest(fields.get('description'), 'summary') && fromManifest(players.get('min'), 'minPlayers') && fromManifest(players.get('max'), 'maxPlayers'),
  };
}

module.exports = { inspectManifestAuthoring };
