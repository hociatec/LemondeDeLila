#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', 'src');
const PUBLIC_OR_CONNECTION_AUTHENTICATED_WS = new Set([
  'modules/notification/infrastructure/presentation/ws/notification-ws.handler.ts',
  'modules/notification/infrastructure/presentation/ws/notification-ws-inbox.handler.ts',
  'modules/notification/infrastructure/presentation/ws/notification-ws-inbox-thread.handler.ts',
  'modules/presence/infrastructure/presentation/ws/presence-ws.handler.ts',
]);
const PUBLIC_WS_METHODS = new Set([
  'modules/catalog/infrastructure/presentation/ws/catalog-ws.handler.ts:all',
  'modules/catalog/infrastructure/presentation/ws/catalog-ws.handler.ts:categories',
  'modules/catalog/infrastructure/presentation/ws/catalog-ws.handler.ts:categoryGames',
  'modules/catalog/infrastructure/presentation/ws/catalog-ws.handler.ts:games',
  'modules/stats/infrastructure/presentation/ws/stats-ws.handler.ts:leaderboardGames',
  'modules/stats/infrastructure/presentation/ws/stats-ws.handler.ts:leaderboardTop',
  'modules/user/infrastructure/presentation/ws/auth-ws.handler.ts:register',
  'modules/user/infrastructure/presentation/ws/auth-ws.handler.ts:login',
  'modules/user/infrastructure/presentation/ws/auth-ws.handler.ts:refresh',
  'modules/user/infrastructure/presentation/ws/auth-ws.handler.ts:logout',
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
      const methodName = method.name.getText(ast);
      if (
        !PUBLIC_WS_METHODS.has(`${name}:${methodName}`) &&
        !/\brequire(?:User|Admin)\s*\(/.test(body)
      ) {
        violations.push(
          `${name}:${methodName} sans contrôle d'authentification`,
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
  const explicitlyPublic =
    /@Controller\(['"](?:health|updates|api\/updates)/.test(source);
  return mutates && !guarded && !explicitlyPublic
    ? [`${name}: endpoint mutable sans garde explicite`]
    : [];
}

function audit() {
  const violations = walk().flatMap((file) => {
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
      ...(name.includes('/infrastructure/presentation/ws/') &&
      name.endsWith('.handler.ts')
        ? auditWsHandler(file, source, ast)
        : []),
      ...(name.endsWith('.controller.ts')
        ? auditHttpController(file, source)
        : []),
    ];
  });
  const ownershipContracts = [
    [
      'modules/messaging/infrastructure/presentation/ws/messaging-ws.handler.ts',
      /messaging\.(?:delete|restore|purge|markRead)\(user\.id/,
    ],
    [
      'modules/social/infrastructure/presentation/ws/social-ws.handler.ts',
      /social\.getProfile\(user\.id,\s*targetId\)/,
    ],
    [
      'modules/stats/infrastructure/presentation/ws/stats-ws.handler.ts',
      /social\.getProfile\(user\.id,\s*dto\.userId\)/,
    ],
    [
      'modules/vault/infrastructure/presentation/ws/vault-ws.handler.ts',
      /vault\.(?:save|restore|delete)\(user\.id/,
    ],
    [
      'modules/room/infrastructure/presentation/ws/room-lobby-ws.handler.ts',
      /requireUser\(session\)/,
    ],
    [
      'modules/notification/infrastructure/persistence/typeorm/repositories/notification-inbox-typeorm.repository.ts',
      /\.andWhere\('user_id = :userId', \{ userId \}\)/,
    ],
    [
      'modules/notification/infrastructure/presentation/ws/notification-ws-inbox.handler.ts',
      /deleteInboxItem\(meta\.userId, id\)/,
    ],
    [
      'modules/notification/infrastructure/presentation/ws/notification-ws-inbox-thread.handler.ts',
      /notificationInboxActor\(meta\)[\s\S]*meta\.userId/,
    ],
  ];
  for (const [name, contract] of ownershipContracts) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    if (!contract.test(source))
      violations.push(`${name}: garde ownership/IDOR absente`);
  }
  const inputContracts = [
    ['main.ts', /json\(\{ limit: '256kb' \}\)/],
    ['main.ts', /parameterLimit: 200/],
    [
      'platform/ws/infrastructure/platform/lila-ws.adapter.ts',
      /DEFAULT_MAX_PAYLOAD_BYTES/,
    ],
    [
      'modules/update/infrastructure/persistence/wx-update-upload.service.ts',
      /ENOSPC/,
    ],
    ['shared/utils/atomic-file.utils.ts', /handle\.sync\(\)[\s\S]*fs\.rename/],
    [
      'shared/utils/atomic-file.utils.ts',
      /fsSync\.fsyncSync[\s\S]*fsSync\.renameSync/,
    ],
    [
      'modules/sounds/infrastructure/storage/sounds.service.ts',
      /assertStorageCapacity/,
    ],
    [
      'platform/observability/infrastructure/logging/serv-logger.service.ts',
      /sanitizeLogText/,
    ],
    [
      'game/core/infrastructure/logging/game-logger.service.ts',
      /sanitizeLogValue/,
    ],
  ];
  for (const [name, contract] of inputContracts) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    if (!contract.test(source))
      violations.push(`${name}: garde de saturation/entrée absente`);
  }
  const authorizationMatrix = fs.readFileSync(
    path.resolve(
      __dirname,
      '../docs/architecture/authorization-resource-matrix.md',
    ),
    'utf8',
  );
  for (const resource of [
    'messages privés',
    'notifications/inbox',
    'rooms',
    'vault',
    'relations sociales',
    'statistiques utilisateur',
    'chat',
    'bots de room',
    'bug reports',
    'administration utilisateurs',
    'sons et updates',
    'profil utilisateur',
  ]) {
    if (!authorizationMatrix.includes(`| ${resource} |`)) {
      violations.push(`matrice authorization: ressource absente ${resource}`);
    }
  }
  return violations;
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
