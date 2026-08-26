#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const backendRoot = path.resolve(__dirname, '..');
const gamesRoot = path.join(backendRoot, 'src', 'game', 'games');
const jsonOutput = process.argv.includes('--json');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function codeLines(source) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  );
  const lines = new Set();
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.WhitespaceTrivia ||
      token === ts.SyntaxKind.NewLineTrivia ||
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }
    lines.add(scanner.getTokenPos() === 0 ? 1 : source.slice(0, scanner.getTokenPos()).split('\n').length);
  }
  return lines.size;
}

function importedPrimitives(source) {
  const sourceFile = ts.createSourceFile(
    'game.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.moduleSpecifier.text.endsWith('core/application/public-api')
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) names.add(element.name.text);
  }
  return [...names].sort();
}

function gameReport(manifestFile) {
  const directory = path.dirname(manifestFile);
  const manifest = JSON.parse(
    fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''),
  );
  const files = walk(directory);
  const sources = files
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => ({
      file,
      name: path.basename(file),
      source: fs.readFileSync(file, 'utf8'),
    }));
  const contentFiles = sources.filter(({ name }) => name === 'content.ts');
  const stateFiles = sources.filter(({ name }) => name === 'state.ts');
  const businessFiles = sources.filter(
    ({ name }) => name !== 'content.ts' && name !== 'state.ts',
  );
  const primitives = new Set(
    sources.flatMap(({ source }) => importedPrimitives(source)),
  );
  const businessLoc = businessFiles.reduce(
    (total, file) => total + codeLines(file.source),
    0,
  );
  const contentLoc = contentFiles.reduce(
    (total, file) => total + codeLines(file.source),
    0,
  );
  const stateLoc = stateFiles.reduce(
    (total, file) => total + codeLines(file.source),
    0,
  );
  const tier =
    businessLoc <= 150 ? 'compact' : businessLoc <= 300 ? 'standard' : 'complex';
  return {
    id: String(manifest.code ?? manifest.id ?? path.basename(directory)),
    businessLoc,
    contentLoc,
    stateLoc,
    tier,
    primitiveCount: primitives.size,
    primitives: [...primitives].sort(),
  };
}

const reports = walk(gamesRoot)
  .filter((file) => path.basename(file) === 'manifest.json')
  .map(gameReport)
  .sort((left, right) => right.businessLoc - left.businessLoc || left.id.localeCompare(right.id));

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
} else {
  console.table(
    reports.map(({ id, businessLoc, contentLoc, stateLoc, tier, primitiveCount }) => ({
      id,
      businessLoc,
      contentLoc,
      stateLoc,
      tier,
      primitives: primitiveCount,
    })),
  );
}

module.exports = { codeLines, gameReport, importedPrimitives };
