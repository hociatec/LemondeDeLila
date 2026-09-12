#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const categorizedSuffix =
  /\.(entity|model|record|dto|command|query|port|adapter)\.ts$/;

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function exportedClasses(source) {
  return [
    ...source.matchAll(/export\s+(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/g),
  ].map((match) => match[1]);
}

function auditFile(file, sourceRoot) {
  const relative = path.relative(sourceRoot, file).replaceAll(path.sep, '/');
  const suffix = relative.match(categorizedSuffix)?.[1];
  if (!suffix || relative.endsWith('.spec.ts')) return [];
  const source = fs.readFileSync(file, 'utf8');
  const violations = [];
  const fail = (reason) => violations.push(`${relative}: ${reason}`);

  if (suffix === 'entity') {
    if (!relative.includes('/entities/')) fail('Entity hors dossier entities');
    if (!/@Entity\s*\(/.test(source))
      fail('Entity ORM sans décorateur @Entity');
  }
  if (suffix === 'record' && !relative.includes('/read-models/')) {
    fail('Record hors dossier application/read-models');
  }
  if (suffix === 'dto') {
    if (!relative.includes('/presentation/'))
      fail('DTO hors frontière presentation');
    for (const name of exportedClasses(source)) {
      if (!name.endsWith('Dto'))
        fail(`classe de transport ${name} sans suffixe Dto`);
    }
  }
  if (
    (suffix === 'command' || suffix === 'query') &&
    !relative.includes('/application/')
  ) {
    fail(`${suffix} hors couche application`);
  }
  if (suffix === 'port' && !relative.includes('/application/ports/')) {
    fail('Port hors dossier application/ports');
  }
  if (
    suffix === 'adapter' &&
    !relative.includes('/infrastructure/') &&
    !relative.startsWith('app/boundaries/')
  ) {
    fail('Adapter hors infrastructure ou app/boundaries');
  }
  if (suffix === 'adapter') {
    for (const name of exportedClasses(source)) {
      if (!name.endsWith('Adapter'))
        fail(`classe ${name} sans suffixe Adapter`);
    }
  }
  return violations;
}

function audit(sourceRoot = path.resolve(__dirname, '..', 'src')) {
  return walk(sourceRoot)
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) => auditFile(file, sourceRoot));
}

if (require.main === module) {
  const violations = audit();
  if (violations.length > 0) {
    console.error(
      `type-naming-convention-audit: ${violations.length} violation(s)`,
    );
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  } else {
    console.log('type-naming-convention-audit: OK');
  }
}

module.exports = { audit, auditFile };
