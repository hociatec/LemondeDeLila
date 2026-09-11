import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { environmentValidationSchema } from './environment-validation';

function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(file)
      : entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
        ? [file]
        : [];
  });
}

it('declares every literal environment read and every RuntimeEnvironmentKey in the startup schema', () => {
  const root = path.resolve(__dirname, '../..');
  const keys = new Set(
    Object.keys(environmentValidationSchema.describe().keys ?? {}),
  );
  const missing: string[] = [];
  for (const file of files(root)) {
    const source = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const check = (key: string) => {
      if (/^[A-Z][A-Z0-9_]+$/.test(key) && !keys.has(key))
        missing.push(`${path.relative(root, file)}: ${key}`);
    };
    function visit(node: ts.Node): void {
      if (
        ts.isCallExpression(node) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const name = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : ts.isIdentifier(node.expression)
            ? node.expression.text
            : '';
        if (
          [
            'get',
            'readEnvironment',
            'readEnvironmentBoolean',
            'positiveInteger',
          ].includes(name)
        )
          check(node.arguments[0].text);
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'environment'
      )
        check(node.name.text);
      if (
        file.endsWith('runtime-environment.ts') &&
        ts.isLiteralTypeNode(node) &&
        ts.isStringLiteral(node.literal)
      )
        check(node.literal.text);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  expect(missing).toEqual([]);
});
