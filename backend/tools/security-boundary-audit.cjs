#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', 'src');
const PUBLIC_OR_CONNECTION_AUTHENTICATED_WS = new Set([
  'catalog/infrastructure/presentation/ws/catalog-ws.handler.ts',
  'notification/infrastructure/presentation/ws/notification-ws.handler.ts',
  'presence/infrastructure/presentation/ws/presence-ws.handler.ts',
  'user/infrastructure/presentation/ws/auth-ws.handler.ts',
]);

function walk(directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? walk(target)
      : entry.name.endsWith('.ts')
        ? [target]
        : [];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function auditWsHandler(file, source, ast) {
  const name = relative(file);
  if (PUBLIC_OR_CONNECTION_AUTHENTICATED_WS.has(name)) return [];
  const violations = [];
  for (const statement of ast.statements) {
    if (!ts.isClassDeclaration(statement)) continue;
    for (const method of statement.members.filter(ts.isMethodDeclaration)) {
      if (
        method.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword,
        )
      ) {
        continue;
      }
      const body = method.body?.getText(ast) ?? '';
      if (!/\brequire(?:User|Admin)\s*\(/.test(body)) {
        violations.push(
          `${name}:${method.name.getText(ast)} sans contrôle d'authentification`,
        );
      }
    }
  }
  return violations;
}

function auditHttpController(file, source) {
  const name = relative(file);
  if (!source.includes('@Controller')) return [];
  const isAdmin = /@Controller\(['"]api\/admin\//.test(source);
  if (isAdmin && !/@UseGuards\(HttpJwtGuard,\s*AdminRoleGuard/.test(source)) {
    return [`${name}: controller admin sans garde JWT + rôle admin`];
  }
  const mutates = /@(Post|Patch|Put|Delete)\b/.test(source);
  const guarded = /@UseGuards\(/.test(source);
  const explicitlyPublic = /@Controller\(['"](?:health|updates|api\/updates)/.test(
    source,
  );
  return mutates && !guarded && !explicitlyPublic
    ? [`${name}: endpoint mutable sans garde explicite`]
    : [];
}

function audit() {
  return walk().flatMap((file) => {
    const name = relative(file);
    if (/\.(spec|test|e2e-spec)\.ts$/.test(name)) return [];
    const source = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    return [
      ...(name.endsWith('.ws.handler.ts')
        ? auditWsHandler(file, source, ast)
        : []),
      ...(name.endsWith('.controller.ts')
        ? auditHttpController(file, source)
        : []),
    ];
  });
}

if (require.main === module) {
  const violations = audit();
  if (violations.length > 0) {
    console.error(`security-boundary-audit: ${violations.length} violation(s)`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log('security-boundary-audit: OK');
  }
}

module.exports = { audit };
