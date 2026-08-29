#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'src');
const moduleNames = [
  'admin', 'bot', 'bug-reports', 'catalog', 'chat', 'client-updates', 'health',
  'messaging', 'notification', 'presence', 'room', 'social', 'sounds', 'stats',
  'update', 'user', 'vault',
];
const platformNames = [
  'auth', 'config', 'database', 'observability', 'pubsub', 'realtime', 'redis',
  'session', 'validation', 'ws',
];
const sharedNames = ['interfaces', 'types', 'utils'];
const runtimeDomains = [
  'actions', 'automation', 'cards', 'choices', 'configuration', 'content',
  'definitions', 'effects', 'events', 'kits', 'lifecycle', 'patterns',
  'projection', 'recipes', 'state', 'submissions',
];
const runtimeRootFiles = new Set([
  'declarative-game.runtime.spec.ts', 'declarative-game.runtime.ts',
  'game-identifiers.ts', 'game-rule-context.ts', 'game-sdk-version.ts',
  'game-selectors.ts', 'public-api.ts', 'typed-contracts.spec.ts',
]);
const allowedRoots = new Set(['modules', 'game', 'platform', 'shared']);
const allowedFacades = new Set([
  'modules/room/application/services/room-lifecycle-facade.service.ts',
  'modules/room/application/services/room-membership-facade.service.ts',
]);

function walk(directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function directoryNames(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function compareDirectories(container, expected, violations) {
  const expectedSet = new Set(expected);
  for (const name of directoryNames(container)) {
    if (!expectedSet.has(name)) violations.push(`${container}/${name}: composant non classé`);
  }
  for (const name of expected) {
    if (!fs.existsSync(path.join(root, container, name))) {
      violations.push(`${container}/${name}: composant manquant`);
    }
  }
}

function audit() {
  const violations = [];
  const roots = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const directory of roots) {
    if (!allowedRoots.has(directory)) violations.push(`racine non classée: ${directory}`);
  }
  compareDirectories('modules', moduleNames, violations);
  compareDirectories('platform', platformNames, violations);
  compareDirectories('shared', sharedNames, violations);
  compareDirectories('game/core/application/runtime', runtimeDomains, violations);
  for (const entry of fs.readdirSync(path.join(root, 'game/core/application/runtime'), { withFileTypes: true })) {
    if (entry.isFile() && !runtimeRootFiles.has(entry.name)) {
      violations.push(`game/core/application/runtime/${entry.name}: runtime non classé par sous-domaine`);
    }
  }
  for (const presenter of [
    'game-ws-state.presenter.ts',
    'game-ws-realtime-state.service.ts',
  ]) {
    if (fs.existsSync(path.join(root, 'game/core/infrastructure/presentation/ws', presenter))) {
      violations.push(`game/core/infrastructure/presentation/ws/${presenter}: projection d'état hors sous-domaine state`);
    }
  }

  for (const component of moduleNames) {
    if (!fs.existsSync(path.join(root, 'modules', component, 'public-api.ts'))) {
      violations.push(`modules/${component}: public-api.ts manquant`);
    }
  }

  const files = walk().filter((file) => file.endsWith('.ts'));
  for (const file of files) {
    const name = relative(file);
    const source = fs.readFileSync(file, 'utf8');
    if (name.includes('/application/models/') && /^models?\.ts$/.test(path.basename(name))) {
      violations.push(`${name}: modèle applicatif sans rôle explicite`);
    }
    if (/\/infrastructure\/.*repository\.ts$/.test(name) && !name.includes('/persistence/')) {
      violations.push(`${name}: repository hors persistence`);
    }
    if (
      name.startsWith('shared/') &&
      /from ['"][^'"]*(?:modules|platform|game)\//.test(source)
    ) {
      violations.push(`${name}: shared dépend d'une frontière supérieure`);
    }
    if (name.startsWith('game/games/') && /game\/core\/application\/runtime/.test(source)) {
      violations.push(`${name}: jeu important directement le runtime privé`);
    }
    if (name.includes('facade') && !allowedFacades.has(name) && !/\.spec\.ts$/.test(name)) {
      violations.push(`${name}: nouvelle façade sans frontière approuvée`);
    }
    if (
      name.startsWith('modules/room/infrastructure/presentation/ws/room-gateway-') &&
      name.endsWith('.service.ts') &&
      !name.endsWith('dispatcher.service.ts') &&
      !name.endsWith('context.service.ts') &&
      /from ['"]\.\/room-gateway-[^'"]+\.service['"]/.test(source)
    ) {
      violations.push(`${name}: couplage direct entre services WS Room`);
    }
  }

  const roomServices = files.filter((file) =>
    relative(file).match(/^modules\/room\/application\/services\/[^/]+\.ts$/),
  );
  if (roomServices.length > 30) {
    violations.push(`modules/room/application/services: ${roomServices.length} fichiers (max 30)`);
  }

  const migrations = files.filter((file) =>
    relative(file).startsWith('platform/database/migrations/'),
  );
  for (const file of migrations) {
    const basename = path.basename(file);
    if (/\.spec\.ts$/.test(basename)) continue;
    if (!/^\d{13}-[A-Z][A-Za-z0-9]+\.ts$/.test(basename)) {
      violations.push(`migration non descriptive: ${basename}`);
    }
  }
  return violations;
}

if (require.main === module) {
  const violations = audit();
  if (violations.length) {
    console.error(`layout-architecture-audit: ${violations.length} violation(s)`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log('layout-architecture-audit: OK');
  }
}

module.exports = { audit };
