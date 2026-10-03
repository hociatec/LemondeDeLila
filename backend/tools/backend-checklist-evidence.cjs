#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'backend-checklist-evidence.json'), 'utf8'),
);
const failures = [];
const covered = new Map();

for (const group of manifest.groups ?? []) {
  const from = group.range?.from;
  const to = group.range?.to;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from > to) {
    failures.push('Un groupe possède une plage invalide');
    continue;
  }
  if (typeof group.command !== 'string' || group.command.trim() === '')
    failures.push(`Commande absente pour ${from}-${to}`);
  for (let id = from; id <= to; id += 1) {
    if (covered.has(id)) failures.push(`Point ${id} couvert plusieurs fois`);
    covered.set(id, group);
  }
  for (const evidence of group.evidence ?? []) {
    if (!fs.existsSync(path.resolve(root, evidence)))
      failures.push(`Preuve absente: ${evidence}`);
  }
}

const range = manifest.range ?? {};
for (let id = range.from; id <= range.to; id += 1) {
  if (!covered.has(id)) failures.push(`Point ${id} sans preuve`);
}
for (const id of covered.keys()) {
  if (id < range.from || id > range.to)
    failures.push(`Point hors périmètre: ${id}`);
}

const unresolved = fs.readFileSync(path.join(root, 'backend.txt'), 'utf8').trim();
if (unresolved !== '') failures.push('backend.txt contient encore des points ouverts');

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(
    `backend-checklist-evidence: OK (${covered.size} points, ${manifest.groups.length} groupes reproductibles)`,
  );
}
