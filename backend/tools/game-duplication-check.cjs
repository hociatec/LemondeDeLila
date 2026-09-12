#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const effectPacksRoot = path.resolve(
  __dirname,
  '..',
  'src',
  'game',
  'engine',
  'runtime',
  'effect-packs',
);
const minimumTokens = 160;
const requiredGames = 2;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return target.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(target)
      ? [target]
      : [];
  });
}

function packId(root, file) {
  return path.relative(root, file).split(path.sep)[0];
}

function signature(source) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  );
  const tokens = [];
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
    if (token === ts.SyntaxKind.Identifier) tokens.push('<id>');
    else if (
      token === ts.SyntaxKind.StringLiteral ||
      token === ts.SyntaxKind.NumericLiteral ||
      token === ts.SyntaxKind.NoSubstitutionTemplateLiteral
    ) {
      tokens.push('<literal>');
    } else tokens.push(String(token));
  }
  return tokens.length >= minimumTokens
    ? {
        tokens: tokens.length,
        hash: crypto
          .createHash('sha256')
          .update(tokens.join(','))
          .digest('hex'),
      }
    : null;
}

function inspectDuplicates(root = effectPacksRoot) {
  const groups = new Map();
  for (const file of walk(root).filter(
    (candidate) => path.dirname(candidate) !== root,
  )) {
    const source = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    function visit(node) {
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)
      ) {
        const candidate = signature(node.getText(sourceFile));
        if (candidate) {
          const group = groups.get(candidate.hash) ?? {
            tokens: candidate.tokens,
            occurrences: [],
          };
          group.occurrences.push({
            pack: packId(root, file),
            file: path.relative(path.resolve(__dirname, '..'), file),
            line:
              sourceFile.getLineAndCharacterOfPosition(
                node.getStart(sourceFile),
              ).line + 1,
          });
          groups.set(candidate.hash, group);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  return [...groups.values()].filter(
    (group) =>
      new Set(group.occurrences.map((entry) => entry.pack)).size >=
      requiredGames,
  );
}

function main() {
  const violations = inspectDuplicates();
  if (violations.length === 0) {
    console.log(
      'effect-pack-duplication: OK (fonctions normalisées, seuil de deux packs)',
    );
    return;
  }
  for (const violation of violations) {
    console.error(
      `Mécanique dupliquée (${violation.tokens} tokens) dans au moins ${requiredGames} packs:`,
    );
    for (const occurrence of violation.occurrences) {
      console.error(`  ${occurrence.file}:${occurrence.line}`);
    }
  }
  console.error(
    'Revue moteur requise dès le deuxième jeu : extraire la mécanique commune ou préciser les différences métier.',
  );
  process.exitCode = 1;
}

module.exports = { inspectDuplicates, signature };
if (require.main === module) main();
