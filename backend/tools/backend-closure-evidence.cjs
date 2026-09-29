#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'backend-closure-evidence.json'),
    'utf8',
  ),
);
const failures = [];
const covered = new Map();

for (const group of manifest.groups ?? []) {
  if (!Array.isArray(group.ids) || group.ids.length === 0) {
    failures.push('Un groupe de preuve ne contient aucun identifiant');
    continue;
  }
  if (typeof group.command !== 'string' || group.command.length === 0) {
    failures.push(`Commande absente pour ${group.ids.join(',')}`);
  }
  for (const id of group.ids) {
    if (covered.has(id)) failures.push(`Point ${id} couvert plusieurs fois`);
    covered.set(id, group);
  }
  for (const evidence of group.evidence ?? []) {
    if (!fs.existsSync(path.resolve(root, evidence))) {
      failures.push(`Preuve absente: ${evidence}`);
    }
  }
}

const range = manifest.range ?? {};
if (
  !Number.isSafeInteger(range.from) ||
  !Number.isSafeInteger(range.to) ||
  range.from < 1 ||
  range.to < range.from
) {
  failures.push('Périmètre de certification invalide');
}
for (let id = range.from; id <= range.to; id += 1) {
  if (!covered.has(id)) failures.push(`Point ${id} sans preuve`);
}
for (const id of covered.keys()) {
  if (id < range.from || id > range.to)
    failures.push(`Point hors périmètre: ${id}`);
}

const debt = fs.readFileSync(path.join(root, 'dette.txt'), 'utf8');
const unresolved = debt.match(/^\s*(\d+)\./gm) ?? [];
if (unresolved.length > 0) {
  failures.push(`Dette encore ouverte: ${unresolved.join(', ')}`);
}

const workflow = fs.readFileSync(
  path.resolve(root, '../.github/workflows/backend-architecture.yml'),
  'utf8',
);
for (const expected of [
  'npm run quality:check',
  'npm run typecheck',
  'npm run lint',
  'npm test -- --maxWorkers=2 --shard=',
  'npm run test:integration:real',
]) {
  if (!workflow.includes(expected)) {
    failures.push(`Certification CI absente: ${expected}`);
  }
}

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `backend-closure-evidence: OK (${covered.size} points, ${manifest.groups.length} groupes reproductibles)`,
  );
}
