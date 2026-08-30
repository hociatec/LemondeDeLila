#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', 'src');
const DIRECT_SQL_ADAPTERS = new Set([
  'game/core/infrastructure/persistence/typeorm/mysql-game-room-lock.service.ts',
]);

function files(directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(target);
    return entry.name.endsWith('.ts') ? [target] : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function sourceFile(file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function propertyName(call) {
  return ts.isPropertyAccessExpression(call.expression)
    ? call.expression.name.text
    : null;
}

function objectHasProperty(node, name) {
  return (
    ts.isObjectLiteralExpression(node) &&
    node.properties.some(
      (property) =>
        property.name &&
        property.name.getText().replaceAll(/["']/g, '') === name,
    )
  );
}

function identifierHasBound(source, identifier) {
  let found = false;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === identifier &&
      node.initializer &&
      /\.(take|limit)\s*\(/.test(node.initializer.getText())
    ) {
      found = true;
      return;
    }
    if (found || !ts.isCallExpression(node)) {
      if (!found) ts.forEachChild(node, visit);
      return;
    }
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      ['take', 'limit'].includes(node.expression.name.text) &&
      node.expression.expression.getText().startsWith(identifier)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function auditFile(file) {
  const name = relative(file);
  if (name.includes('/migrations/') || name.startsWith('migrations/'))
    return [];
  if (/\.(spec|test|e2e-spec)\.ts$/.test(name)) return [];
  const source = fs.readFileSync(file, 'utf8');
  const ast = sourceFile(file);
  const violations = [];
  const nPlusOneSensitive =
    /^modules\/(messaging|notification|social|stats|user|room)\/application\//.test(
      name,
    );
  const visit = (node) => {
    if (
      nPlusOneSensitive &&
      (ts.isForOfStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isForStatement(node) ||
        ts.isWhileStatement(node)) &&
      containsAwait(node.statement)
    ) {
      violations.push(`${name}: await dans une boucle sensible au N+1`);
    }
    if (ts.isCallExpression(node)) {
      const method = propertyName(node);
      if (method === 'query' && !DIRECT_SQL_ADAPTERS.has(name)) {
        violations.push(`${name}: SQL direct hors adapter dédié`);
      }
      if (
        method === 'createQueryBuilder' &&
        !name.includes('/infrastructure/persistence/typeorm/')
      ) {
        violations.push(`${name}: query builder hors adapter TypeORM`);
      }
      if (
        (method === 'find' || method === 'findAndCount') &&
        name.includes('/infrastructure/persistence/typeorm/repositories/') &&
        node.arguments[0] &&
        !objectHasProperty(node.arguments[0], 'take')
      ) {
        violations.push(`${name}: collection TypeORM sans limite take`);
      }
      if (
        ['getMany', 'getManyAndCount', 'getRawMany'].includes(method ?? '') &&
        name.includes('/infrastructure/persistence/typeorm/repositories/')
      ) {
        const chain = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.expression.getText()
          : '';
        const boundedIdentifier =
          ts.isIdentifier(node.expression.expression) &&
          identifierHasBound(ast, node.expression.expression.text);
        if (!/\.(take|limit)\s*\(/.test(chain) && !boundedIdentifier) {
          violations.push(`${name}: query builder de collection sans limite`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (
    /\b(GET_LOCK|RELEASE_LOCK|ON DUPLICATE KEY|JSON_EXTRACT)\b/i.test(source) &&
    !DIRECT_SQL_ADAPTERS.has(name)
  ) {
    violations.push(`${name}: dialecte SQL spécifique hors adapter`);
  }
  return violations;
}

function containsAwait(node) {
  let found = false;
  const visit = (child) => {
    if (ts.isAwaitExpression(child)) found = true;
    if (!found) ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function audit() {
  const violations = files().flatMap(auditFile);
  const lockSource = fs.readFileSync(
    path.join(root, [...DIRECT_SQL_ADAPTERS][0]),
    'utf8',
  );
  if (!/GET_LOCK\(\?,\s*\?\)/.test(lockSource)) {
    violations.push('mysql-game-room-lock: GET_LOCK doit rester paramétré');
  }
  if (!/RELEASE_LOCK\(\?\)/.test(lockSource)) {
    violations.push('mysql-game-room-lock: RELEASE_LOCK doit rester paramétré');
  }
  const atomicWriteContracts = [
    ['game/core/infrastructure/persistence/typeorm/repositories/game-session-typeorm.store.ts', /manager\.transaction/],
    ['modules/stats/infrastructure/persistence/typeorm/repositories/game-match-typeorm.repository.ts', /manager\.transaction/],
    ['modules/room/infrastructure/persistence/typeorm/repositories/room-typeorm.repository.ts', /manager\.transaction/],
    ['modules/admin/infrastructure/persistence/typeorm/repositories/role-definition-typeorm.repository.ts', /manager\.transaction/],
    ['modules/bot/infrastructure/persistence/typeorm/repositories/bot-room-typeorm.repository.ts', /pessimistic_write/],
    ['modules/vault/application/services/vault-snapshot-restore.service.ts', /compensat/i],
  ];
  for (const [name, contract] of atomicWriteContracts) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    if (!contract.test(source)) {
      violations.push(`${name}: contrat transaction/compensation absent`);
    }
  }
  return violations;
}

if (require.main === module) {
  const violations = audit();
  if (violations.length > 0) {
    console.error(`persistence-audit: ${violations.length} violation(s)`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log('persistence-audit: OK');
  }
}

module.exports = { audit, auditFile };
