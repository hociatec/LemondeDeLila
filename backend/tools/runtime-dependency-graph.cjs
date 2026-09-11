'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/** All local production dependencies count, including type imports and barrels. */
function analyzeRuntime(directory) {
  const root = path.resolve(directory);
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) files.push(file);
    }
  }
  walk(root);
  const known = new Set(files);
  const graph = new Map();
  const configFile = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
  const configured = configFile ? ts.parseJsonConfigFileContent(ts.readConfigFile(configFile, ts.sys.readFile).config, ts.sys, path.dirname(configFile)).options : {};
  const options = {module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, ...configured};
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const edges = new Set();
    function visit(node) {
      let specifier;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) specifier = node.argument.literal.text;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) specifier = node.moduleReference.expression.text;
      if (specifier) {
        const target = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
        if (target && known.has(path.normalize(target))) edges.add(path.normalize(target));
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    graph.set(file, [...edges]);
  }
  let sequence = 0;
  const indices = new Map(), low = new Map(), stack = [], active = new Set(), cycles = [];
  function visit(file) {
    indices.set(file, sequence); low.set(file, sequence++); stack.push(file); active.add(file);
    for (const target of graph.get(file)) {
      if (!indices.has(target)) { visit(target); low.set(file, Math.min(low.get(file), low.get(target))); }
      else if (active.has(target)) low.set(file, Math.min(low.get(file), indices.get(target)));
    }
    if (low.get(file) !== indices.get(file)) return;
    const component = []; let target;
    do { target = stack.pop(); active.delete(target); component.push(target); } while (target !== file);
    if (component.length > 1 || graph.get(file).includes(file)) cycles.push(component.map(value => path.relative(root, value).replaceAll('\\', '/')).sort());
  }
  for (const file of files) if (!indices.has(file)) visit(file);
  const compilerDependencies = [];
  const executionRoots = files.filter(file => /^(?:declarative-game\.runtime|game-rule-context|lifecycle\/[^/]+|effects\/effect-engine|actions\/declarative-action-controller|choices\/declarative-choice-runtime|projection\/declarative-game-queries)\.ts$/.test(path.relative(root,file).replaceAll('\\','/')));
  for (const entry of executionRoots) {
    const visited = new Set();
    const queue = [[entry]];
    for (const chain of queue) {
      const current = chain[chain.length - 1];
      if (visited.has(current)) continue;
      visited.add(current);
      if (/^(?:game-definition-(?:compiler|validator|contracts|composition)|game-plan-compiler|pattern-definition|gameplay-pattern-core|gameplay-recipes)\.ts$/.test(path.basename(current))) {
        compilerDependencies.push(chain.map(file => path.relative(root,file).replaceAll('\\','/')));
        continue;
      }
      for (const dependency of graph.get(current)) queue.push([...chain, dependency]);
    }
  }
  return {files: files.length, cycles: cycles.sort((a,b) => b.length - a.length || a[0].localeCompare(b[0])), compilerDependencies};
}

if (require.main === module) {
  const result = analyzeRuntime(path.join(__dirname, '../src/game/engine/runtime'));
  console.log(JSON.stringify(result, null, 2));
  if (result.cycles.length || result.compilerDependencies.length) process.exitCode = 1;
}
module.exports = {analyzeRuntime};
