#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'src');
const businessRoots = [
  'admin', 'bot', 'bug-reports', 'catalog', 'chat', 'client-updates', 'game',
  'health', 'messaging', 'notification', 'presence', 'realtime', 'room',
  'social', 'sounds', 'stats', 'update', 'user', 'vault',
];
const platformRoots = ['common', 'config', 'database', 'migrations', 'types'];
const allowedRoots = new Set([...businessRoots, ...platformRoots, 'architecture-tests']);
const allowedFacades = new Set([
  'room/application/services/room-lifecycle-facade.service.ts',
  'room/application/services/room-membership-facade.service.ts',
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

function audit() {
  const violations = [];
  const roots = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const directory of roots) {
    if (!allowedRoots.has(directory)) violations.push(`racine non classée: ${directory}`);
  }
  for (const component of businessRoots) {
    if (!fs.existsSync(path.join(root, component, 'public-api.ts'))) {
      violations.push(`${component}: public-api.ts manquant`);
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
    if (name.includes('/common/utils/') && /from ['"](?:\.\.\/){3,}(?!common\/)/.test(source)) {
      violations.push(`${name}: utilitaire common dépendant du métier`);
    }
    if (name.startsWith('game/games/') && /game\/core\/application\/runtime/.test(source)) {
      violations.push(`${name}: jeu important directement le runtime privé`);
    }
    if (name.includes('facade') && !allowedFacades.has(name) && !/\.spec\.ts$/.test(name)) {
      violations.push(`${name}: nouvelle façade sans frontière approuvée`);
    }
    if (
      name.startsWith('room/infrastructure/presentation/ws/room-gateway-') &&
      name.endsWith('.service.ts') &&
      !name.endsWith('dispatcher.service.ts') &&
      !name.endsWith('context.service.ts') &&
      /from ['"]\.\/room-gateway-[^'"]+\.service['"]/.test(source)
    ) {
      violations.push(`${name}: couplage direct entre services WS Room`);
    }
  }

  const roomServices = files.filter((file) =>
    relative(file).match(/^room\/application\/services\/[^/]+\.ts$/),
  );
  if (roomServices.length > 30) {
    violations.push(`room/application/services: ${roomServices.length} fichiers (max 30)`);
  }

  const migrations = files.filter((file) => relative(file).startsWith('migrations/'));
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
