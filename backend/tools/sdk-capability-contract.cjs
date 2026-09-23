'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function inspectCapabilities(source, file = 'capability.ts') {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const errors = [];
  function explicit(node) {
    return (
      node &&
      ((ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) ||
        (ts.isUnionTypeNode(node) && node.types.every(explicit)))
    );
  }
  function visit(node) {
    if (
      ts.isTypeReferenceNode(node) &&
      node.typeName.getText(tree) === 'PublicController' &&
      (node.typeArguments?.length !== 2 || !explicit(node.typeArguments[1]))
    )
      errors.push(
        `${file}: controller capability must enumerate reviewed method names`,
      );
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return errors;
}
function assertSdkCapabilities() {
  const directory = path.resolve(
    __dirname,
    '../src/game/engine/runtime/contracts',
  );
  const files = fs
    .readdirSync(directory)
    .filter((file) => /^context-.*capability\.ts$/.test(file));
  files.push('../definitions/game-context-contracts.ts');
  const errors = files.flatMap((file) =>
    inspectCapabilities(
      fs.readFileSync(path.join(directory, file), 'utf8'),
      file,
    ),
  );
  if (errors.length) throw new Error(errors.join('\n'));
}
module.exports = { inspectCapabilities, assertSdkCapabilities };
