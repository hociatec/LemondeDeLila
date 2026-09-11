#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', 'src');
const MAX_DEPTH = 9;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(file);
    return file.endsWith('.ts') && !/\.spec\.ts$|\.test\.ts$/.test(file)
      ? [file]
      : [];
  });
}

function graphForFiles(files) {
  const graph = new Map();
  for (const file of files) {
    const filePath = typeof file === 'string' ? file : file.file;
    const source = typeof file === 'string' ? fs.readFileSync(file, 'utf8') : file.source;
    const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
      if (!ts.isClassDeclaration(node) || !node.name) continue;
      const className = node.name.text;
      const dependencies = new Map();
      const constructor = node.members.find(ts.isConstructorDeclaration);
      for (const parameter of constructor?.parameters ?? []) {
        if (!parameter.name || !ts.isIdentifier(parameter.name)) continue;
        const type = parameter.type?.getText(ast).replace(/^import\([^)]*\)\./, '');
        if (type && /^[A-Z][A-Za-z0-9_]*$/.test(type)) {
          dependencies.set(parameter.name.text, type);
        }
      }
      const targets = new Set();
      const visit = (child) => {
        if (
          ts.isPropertyAccessExpression(child) &&
          ts.isPropertyAccessExpression(child.expression) &&
          ts.isThis(child.expression.expression)
        ) {
          const dependency = child.expression.name.text;
          const target = dependencies.get(dependency);
          if (target) targets.add(target);
        }
        ts.forEachChild(child, visit);
      };
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
          ts.forEachChild(member, visit);
        }
      }
      graph.set(className, targets);
    }
  }
  return graph;
}

function longestPath(graph) {
  const memo = new Map();
  const visiting = new Set();
  const visit = (node) => {
    if (memo.has(node)) return memo.get(node);
    if (visiting.has(node)) return 0;
    visiting.add(node);
    let depth = 1;
    for (const target of graph.get(node) ?? []) {
      depth = Math.max(depth, 1 + visit(target));
    }
    visiting.delete(node);
    memo.set(node, depth);
    return depth;
  };
  return [...graph.keys()].reduce((max, node) => Math.max(max, visit(node)), 0);
}

function longestPathInfo(graph) {
  const memo = new Map();
  const visiting = new Set();
  const visit = (node) => {
    if (memo.has(node)) return memo.get(node);
    if (visiting.has(node)) return { depth: 0, path: [] };
    visiting.add(node);
    let best = { depth: 1, path: [node] };
    for (const target of graph.get(node) ?? []) {
      const candidate = visit(target);
      if (1 + candidate.depth > best.depth) {
        best = { depth: 1 + candidate.depth, path: [node, ...candidate.path] };
      }
    }
    visiting.delete(node);
    memo.set(node, best);
    return best;
  };
  return [...graph.keys()].reduce((best, node) => {
    const candidate = visit(node);
    return candidate.depth > best.depth ? candidate : best;
  }, { depth: 0, path: [] });
}

function analyze({ files = walk(root) } = {}) {
  const graph = graphForFiles(files);
  return { classes: graph.size, maxDepth: longestPath(graph), graph };
}

const result = analyze();
console.log(`service-call-depth: ${result.classes} classes, profondeur maximale ${result.maxDepth}`);
console.log(`service-call-depth: chaîne maximale ${longestPathInfo(result.graph).path.join(' -> ')}`);
if (result.maxDepth > MAX_DEPTH) {
  console.error(`service-call-depth: profondeur ${result.maxDepth} > limite ${MAX_DEPTH}`);
  process.exitCode = 1;
} else {
  console.log('service-call-depth: OK');
}

module.exports = { analyze, graphForFiles, longestPath, longestPathInfo, MAX_DEPTH };
