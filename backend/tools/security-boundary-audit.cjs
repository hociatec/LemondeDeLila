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
      /profiles\.getProfile\(user\.id,\s*targetId\)/,
    ],
    [
      'modules/stats/infrastructure/presentation/ws/stats-ws.handler.ts',
      /profiles\.getProfile\(user\.id,\s*dto\.userId\)/,
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
      'modules/room/infrastructure/presentation/ws/room-lobby-invites.service.ts',
      /requireOwnedRoom\([\s\S]*requireInviteRecipient\(/,
    ],
    [
      'game/core/infrastructure/presentation/ws/game-ws.handler.ts',
      /ensureReadable\(roomId, user\.id\)[\s\S]*ensureWritable\(roomId, user\.id\)/,
    ],
    [
      'modules/vault/application/services/vault-snapshot-writer.service.ts',
      /requireRoomForOwnerAction\(roomId, ownerUserId\)[\s\S]*findByIdForOwner\(requestedId, ownerUserId\)/,
    ],
    [
      'modules/vault/application/services/vault-snapshot-restore.service.ts',
      /findByIdForOwner\(id, ownerUserId\)/,
    ],
    [
      'modules/messaging/application/services/private-messaging.service.ts',
      /isSender[\s\S]*isRecipient[\s\S]*ForbiddenException[\s\S]*recipient\?\.id !== userId/,
    ],
    [
      'modules/notification/application/services/admin-contact.service.ts',
      /replyFromStaffToUser\([\s\S]*this\.assertStaff\(from\.roles\)/,
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
    ['main.ts', /isBoundedJsonInput\(request\.body\)/],
    ['platform/ws/infrastructure/presentation/ws/ws-message-codec.ts', /isBoundedJsonInput\(parsed\)/],
    ['modules/presence/application/services/presence-client-message.service.ts', /isBoundedJsonInput\(value\)/],
    [
      'modules/presence/application/services/presence-client-message.service.ts',
      /presenceMessageKeys\(record\.type\)[\s\S]*hasOnlyAllowedKeys\(record, keys\)/,
    ],
    [
      'modules/room/infrastructure/presentation/ws/room-intent-decoder.ts',
      /hasOnlyAllowedKeys\(envelope, \['intentId', 'data', '_trace'\]\)[\s\S]*hasOnlyAllowedKeys\(commandPayload, \[\.\.\.allowedKeys, '_trace'\]\)/,
    ],
    ['modules/notification/infrastructure/presentation/ws/notification-ws-connection.service.ts', /isBoundedJsonInput\(value\)/],
    ['platform/ws/infrastructure/platform/lila-ws.adapter.ts', /isAllowedWsOrigin/],
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
    [
      'modules/update/infrastructure/http/ci-wx-update.controller.ts',
      /hasOnlyAllowedKeys\(body,[\s\S]*?'installerTotalBytes'[\s\S]*?hasOnlyAllowedKeys\(body, \['uploadId', 'index', 'kind'\]\)[\s\S]*?hasOnlyAllowedKeys\(body, \['uploadId'\]\)/,
    ],
    [
      'modules/sounds/infrastructure/presentation/http/controllers/admin-sounds.controller.ts',
      /requireExactBody\(body, \['name'\]\)[\s\S]*?requireExactBody\(body, \['enabled'\]\)/,
    ],
    [
      'game/core/application/models/validated-game-action.model.ts',
      /isBoundedJsonInput\(action,[\s\S]*?whitelist: true,[\s\S]*?forbidNonWhitelisted: true/,
    ],
    ['platform/filesystem/infrastructure/atomic-file.utils.ts', /handle\.sync\(\)[\s\S]*fs\.rename/],
    [
      'platform/filesystem/infrastructure/atomic-file.utils.ts',
      /fsSync\.fsyncSync[\s\S]*fsSync\.renameSync/,
    ],
    [
      'modules/sounds/infrastructure/storage/sounds-upload.manager.ts',
      /(?=[\s\S]*createReadStream\(filePath\))(?=[\s\S]*copyFileAtomic\()/,
    ],
    [
      'modules/sounds/infrastructure/storage/sounds-reencoder.ts',
      /(?=[\s\S]*createReadStream\(filePath\))(?=[\s\S]*copyFileAtomic\()/,
    ],
    [
      'modules/sounds/infrastructure/storage/sounds-audio-process.ts',
      /(?=[\s\S]*AUDIO_PROCESS_QUEUE_LIMIT)(?=[\s\S]*maxOutputBytes)(?=[\s\S]*setTimeout\()(?=[\s\S]*child\.kill\('SIGKILL'\))/,
    ],
    [
      'modules/sounds/infrastructure/presentation/http/controllers/admin-sounds.controller.ts',
      /diskStorage\([\s\S]*limits: \{ fileSize: 250 \* 1024 \* 1024 \}/,
    ],
    [
      'modules/update/infrastructure/http/ci-wx-update.controller.ts',
      /dest: os\.tmpdir\(\)[\s\S]*limits: \{ fileSize: 15 \* 1024 \* 1024 \}/,
    ],
    [
      'modules/update/infrastructure/persistence/wx-update-upload-storage.ts',
      /MAX_UPLOAD_DIRECTORY_ENTRIES[\s\S]*createReadStream\([\s\S]*combinedBytes > input\.expectedBytes/,
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
  const authoritativeReadContracts = [
    [
      'modules/room/application/services/state/room-payload.service.ts',
      /getRoomPayload\(roomId: number\)[\s\S]*?return this\.refreshRoomPayload\(roomId\)/,
    ],
    [
      'modules/room/application/services/membership/room-game-access.service.ts',
      /Authorization deliberately reads persistence[\s\S]*?findByIdWithPayloadRelations/,
    ],
    [
      'modules/catalog/application/use-cases/catalog/get-catalog-game.service.ts',
      /listGames\.execute\(\{ fresh: true \}\)/,
    ],
    [
      'modules/bot/application/use-cases/bot-names/bot-name-selection.service.ts',
      /cache\.refreshEnabledNames\(\)/,
    ],
    [
      'game/core/application/services/game-registry.service.ts',
      /async listGames[\s\S]*?await this\.overrides\?\.reload\(\)/,
    ],
    [
      'game/core/application/services/game-content.service.ts',
      /async getRules[\s\S]*?await this\.overrides\?\.reload\(\)/,
    ],
    [
      'modules/chat/application/use-cases/chat/list-recent-normalized-chat-messages.service.ts',
      /listRecentMessages\.execute\([\s\S]*?ChatMessageCacheService\.CACHE_LIMIT/,
    ],
    [
      'modules/social/application/services/social-profile.service.ts',
      /const settings = await this\.settings\.getFresh\(\)/,
    ],
  ];
  for (const [name, contract] of authoritativeReadContracts) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    if (!contract.test(source)) {
      violations.push(
        `${name}: décision ou lecture métier fondée sur un cache`,
      );
    }
  }
  const presenceChatSource = fs.readFileSync(
    path.join(
      root,
      'modules/presence/application/services/presence-chat.service.ts',
    ),
    'utf8',
  );
  if (
    (
      presenceChatSource.match(/getAuthoritativeChatBanPayload\(user\.id\)/g) ??
      []
    ).length !== 3
  ) {
    violations.push(
      'modules/presence/application/services/presence-chat.service.ts: commandes chat sans lecture de bannissement persistée',
    );
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
