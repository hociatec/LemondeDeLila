#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const gamesRoot = path.join(root, 'src/game/games');
const baselineFile = path.join(__dirname, 'game-json-contracts.json');
const migrationsFile = path.join(__dirname, 'game-json-migrations.json');

function gameDocuments(directory = gamesRoot) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return gameDocuments(target);
      return entry.name === 'game.json' ? [target] : [];
    })
    .sort();
}

function digest(body) {
  return crypto.createHash('sha256').update(body).digest('hex');
}

function inventory() {
  return gameDocuments().map((file) => {
    const body = fs.readFileSync(file);
    const relative = path.relative(root, file).replaceAll(path.sep, '/');
    let document;
    try {
      document = JSON.parse(body.toString('utf8').replace(/^\uFEFF/, ''));
    } catch (error) {
      throw new Error(`${relative}: JSON invalide: ${error.message}`);
    }
    return {
      file: relative,
      sha256: digest(body),
      contentVersion: document.contentVersion,
      definitionVersion: document.definitionVersion,
    };
  });
}

function writeBaseline() {
  const sourceCommit = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const files = inventory();
  fs.writeFileSync(
    baselineFile,
    `${JSON.stringify({ schemaVersion: 1, sourceCommit, files }, null, 2)}\n`,
  );
  console.log(`game-json-contracts: baseline écrite (${files.length} jeux)`);
}

function migrationKey(file, fromSha256, toSha256) {
  return `${file}\n${fromSha256}\n${toSha256}`;
}

function assertContracts() {
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const migrationDocument = JSON.parse(fs.readFileSync(migrationsFile, 'utf8'));
  const migrations = new Map(
    (migrationDocument.migrations ?? []).map((migration) => [
      migrationKey(migration.file, migration.fromSha256, migration.toSha256),
      migration,
    ]),
  );
  const before = new Map(baseline.files.map((entry) => [entry.file, entry]));
  const after = new Map(inventory().map((entry) => [entry.file, entry]));
  const failures = [];
  const usedMigrations = new Set();
  for (const file of new Set([...before.keys(), ...after.keys()])) {
    const oldEntry = before.get(file);
    const newEntry = after.get(file);
    if (!oldEntry || !newEntry) {
      failures.push(`${file}: ajout/suppression sans contrat de migration`);
      continue;
    }
    if (oldEntry.sha256 === newEntry.sha256) continue;
    const migration = migrations.get(
      migrationKey(file, oldEntry.sha256, newEntry.sha256),
    );
    if (!migration) {
      failures.push(`${file}: hash modifié sans migration déclarée`);
      continue;
    }
    usedMigrations.add(
      migrationKey(file, oldEntry.sha256, newEntry.sha256),
    );
    if (!String(migration.justification ?? '').trim())
      failures.push(`${file}: justification de migration absente`);
    if (!Array.isArray(migration.tests) || migration.tests.length === 0) {
      failures.push(`${file}: scénarios de parité absents`);
    } else {
      for (const testFile of migration.tests) {
        if (
          typeof testFile !== 'string' ||
          !fs.existsSync(path.resolve(root, testFile))
        )
          failures.push(`${file}: preuve de parité absente « ${testFile} »`);
      }
    }
    if (
      !/^\d+$/.test(String(newEntry.contentVersion)) ||
      BigInt(newEntry.contentVersion) <= BigInt(oldEntry.contentVersion)
    )
      failures.push(`${file}: contentVersion non incrémentée`);
  }
  for (const [key, migration] of migrations) {
    if (!usedMigrations.has(key))
      failures.push(`${migration.file}: migration inutilisée ou obsolète`);
  }
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    `game-json-contracts: OK (${after.size} jeux, ${migrations.size} migrations déclarées)`,
  );
}

if (require.main === module) {
  if (process.argv.includes('--write')) writeBaseline();
  else assertContracts();
}

module.exports = { digest, gameDocuments, inventory, migrationKey };
