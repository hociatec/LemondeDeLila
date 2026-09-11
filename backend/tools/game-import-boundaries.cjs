'use strict';
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');

function inspectGameImports(file, source, gameDirectory) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations = [];
  const localImports = [];
  const testing = file.endsWith('.spec.ts');
  function check(specifier) {
    const sdk = /^(?:\.\.\/)+engine\/sdk\/public-api$/.test(specifier);
    const testApi =
      testing && /^(?:\.\.\/)+engine\/(?:testing|json)\/public-api$/.test(specifier);
    const target = path.resolve(path.dirname(file), specifier);
    const inside = path.relative(gameDirectory, target);
    const local =
      specifier.startsWith('.') &&
      inside !== '..' &&
      !inside.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(inside);
    if (!sdk && !testApi && !local)
      violations.push(`Import interdit: ${specifier}`);
    if (local) localImports.push(target);
    if (
      local &&
      path.basename(file) === 'content.ts' &&
      /(?:^|\/)rules(?:\.ts)?$/.test(specifier)
    )
      violations.push('Le contenu ne doit pas importer les règles.');
  }
  function visit(node) {
    if (!testing && ts.isThrowStatement(node))
      violations.push(
        'Utiliser rejectRule/ctx.reject ou rejectContent pour les erreurs de jeu.',
      );
    if (
      ts.isExternalModuleReference(node) &&
      node.expression &&
      ts.isStringLiteralLike(node.expression)
    )
      check(node.expression.text);
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      check(node.moduleSpecifier.text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      check(node.argument.literal.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(ast) === 'require')
    ) {
      if (
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0])
      )
        check(node.arguments[0].text);
      else violations.push('Import dynamique non statique interdit.');
    }
    if (
      !testing &&
      ts.isIdentifier(node) &&
      [
        'process',
        '__dirname',
        '__filename',
        'fetch',
        'WebSocket',
        'XMLHttpRequest',
      ].includes(node.text)
    )
      violations.push(`API infrastructure interdite: ${node.text}`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { violations: [...new Set(violations)], localImports };
}

function gameImportGraph(files) {
  const byPath = new Set(files);
  return new Map(
    files.map((file) => {
      const { localImports } = inspectGameImports(
        file,
        fs.readFileSync(file, 'utf8'),
        path.parse(file).root,
      );
      return [
        file,
        localImports.flatMap((target) => {
          const found = [
            target,
            `${target}.ts`,
            path.join(target, 'index.ts'),
          ].find((candidate) => byPath.has(candidate));
          return found ? [found] : [];
        }),
      ];
    }),
  );
}

function inspectGameCycles(files) {
  const graph = gameImportGraph(files);
  const completed = new Set();
  const active = new Set();
  const cycles = [];
  function visit(file, stack) {
    if (active.has(file)) {
      cycles.push([...stack.slice(stack.indexOf(file)), file]);
      return;
    }
    if (completed.has(file)) return;
    active.add(file);
    for (const next of graph.get(file) ?? []) visit(next, [...stack, file]);
    active.delete(file);
    completed.add(file);
  }
  for (const file of files) visit(file, []);
  return cycles;
}

function gameLayer(file) {
  const name = path.basename(file, '.ts');
  if (/(?:^|[-.])(?:types|constants|state)$/.test(name)) return 0;
  if (/(?:^|[-.])content(?:$|[-.])/.test(name)) return 1;
  if (/(?:^|[-.])(?:rules?|actions|effects|resolution|configuration)(?:$|[-.])/.test(name)) return 2;
  if (name === 'game') return 3;
  return null;
}

/** Include type imports and traverse helpers/barrels so renaming an edge cannot hide it. */
function inspectGameLayers(files) {
  const graph = gameImportGraph(files.filter(file => !file.endsWith('.spec.ts')));
  const violations = [];
  for (const [file, imports] of graph) {
    const layer = gameLayer(file);
    if (layer == null) continue;
    const visited = new Set([file]);
    const pending = imports.map(target => [file, target]);
    while (pending.length) {
      const chain = pending.pop();
      const target = chain[chain.length - 1];
      if (visited.has(target)) continue;
      visited.add(target);
      const targetLayer = gameLayer(target);
      if (targetLayer != null && targetLayer > layer) {
        violations.push(chain);
        continue;
      }
      for (const next of graph.get(target) ?? []) pending.push([...chain, next]);
    }
  }
  return violations;
}

module.exports = { inspectGameImports, inspectGameCycles, inspectGameLayers };
