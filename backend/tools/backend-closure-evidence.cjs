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

for (let id = 101; id <= 180; id += 1) {
  if (!covered.has(id)) failures.push(`Point ${id} sans preuve`);
}
for (const id of covered.keys()) {
  if (id < 101 || id > 180) failures.push(`Point hors périmètre: ${id}`);
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
