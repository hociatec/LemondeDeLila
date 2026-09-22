'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/** Includes type imports, barrels, aliases, JSON, require and dynamic imports. */
function auditEngineBoundary(sourceRoot) {
  const root = path.resolve(sourceRoot);
  const normalize = file => path.relative(root, file).replaceAll('\\', '/');
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : file.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(file) ? [file] : [];
  });
  const files = walk(root);
  const gameCodes = [];
  function collectCodes(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collectCodes(file);
      else if (entry.name === 'manifest.json') {
        const code = JSON.parse(fs.readFileSync(file, 'utf8')).code;
        if (typeof code === 'string' && code) gameCodes.push(code);
      }
    }
  }
  collectCodes(path.join(root, 'game/games'));
  const gameReferences = [];
  const config = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
  const options = config ? ts.parseJsonConfigFileContent(ts.readConfigFile(config, ts.sys.readFile).config, ts.sys, path.dirname(config)).options : {};
  const graph = new Map();
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const edges = new Set();
    function visit(node) {
      if (normalize(file).startsWith('game/engine/') && ts.isStringLiteralLike(node)) {
        const literal = node.text.replaceAll('\\', '/');
        const code = gameCodes.find(code => literal.includes(code));
        if (code || /(?:^|\/)game\/(?:games|rules|composition)(?:\/|$)/.test(literal))
          gameReferences.push({ file: normalize(file), literal });
      }
      let specifier;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) specifier = node.argument.literal.text;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) specifier = node.moduleReference.expression.text;
      if (specifier) {
        const target = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
        if (target && path.resolve(target).startsWith(root + path.sep)) edges.add(path.resolve(target));
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    graph.set(file, [...edges]);
  }
  const engines = files.filter(file => normalize(file).startsWith('game/engine/'));
  const violations = [];
  for (const entry of engines) {
    const visited = new Set();
    const queue = [[entry]];
    for (const chain of queue) {
      const current = chain.at(-1);
      if (visited.has(current)) continue;
      visited.add(current);
      if (/^game\/(rules|games|composition)\//.test(normalize(current))) {
        violations.push(chain.map(normalize));
        break;
      }
      for (const dependency of graph.get(current) ?? []) queue.push([...chain, dependency]);
    }
  }
  return { engineFiles: engines.length, violations, gameReferences };
}

if (require.main === module) {
  const report = auditEngineBoundary(path.join(__dirname, '../src'));
  console.log(JSON.stringify(report, null, 2));
  if (report.violations.length || report.gameReferences.length) process.exitCode = 1;
}
module.exports = { auditEngineBoundary };
