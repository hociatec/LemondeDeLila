#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const [command, first, second] = process.argv.slice(2);
const backendRoot = path.resolve(__dirname, '..');

if (command === 'export' && first) exportCurrent(path.resolve(first));
else if (command === 'publish' && first && second) {
  publish(path.resolve(first), path.resolve(second));
} else if (command === 'rollback' && first && second) {
  activate(path.resolve(first), second);
} else {
  fail('usage: content-release <export SOURCE | publish SOURCE RELEASES | rollback RELEASES ID>');
}

function exportCurrent(outputRoot) {
  const registryPath = path.join(
    backendRoot,
    'dist/game/composition/generated-game-registry.js',
  );
  if (!fs.existsSync(registryPath)) fail('backend compilé absent: exécuter npm run build');
  const { GENERATED_GAME_DEFINITIONS } = require(registryPath);
  const gamesRoot = path.join(outputRoot, 'games');
  fs.mkdirSync(gamesRoot, { recursive: true });
  for (const definition of GENERATED_GAME_DEFINITIONS) {
    if (!definition?.id || !definition?.content?.data) continue;
    writeJson(path.join(gamesRoot, `${safeId(definition.id)}.json`), definition.content.data);
  }
  console.log(`content-release: ${fs.readdirSync(gamesRoot).length} jeux exportés vers ${outputRoot}`);
}

function publish(sourceRoot, releasesRoot) {
  const gamesRoot = path.join(sourceRoot, 'games');
  const files = fs.readdirSync(gamesRoot).filter((file) => file.endsWith('.json')).sort();
  if (files.length === 0) fail('aucun payload games/*.json');
  const payloads = files.map((file) => {
    const gameId = safeId(path.basename(file, '.json'));
    const source = fs.readFileSync(path.join(gamesRoot, file), 'utf8').replace(/^\uFEFF/, '');
    JSON.parse(source);
    const canonical = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;
    return { gameId, file: `games/${gameId}.json`, raw: canonical, sha256: sha256(canonical) };
  });
  const releaseId = sha256(payloads.map(({ gameId, sha256 }) => `${gameId}:${sha256}`).join('\n'));
  fs.mkdirSync(releasesRoot, { recursive: true });
  const target = path.join(releasesRoot, releaseId);
  const temporary = path.join(releasesRoot, `.publishing-${process.pid}-${releaseId}`);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.join(temporary, 'games'), { recursive: true });
    const games = {};
    for (const payload of payloads) {
      fs.writeFileSync(path.join(temporary, payload.file), payload.raw, { flag: 'wx' });
      games[payload.gameId] = {
        file: payload.file,
        sha256: payload.sha256,
        contentVersion: payload.sha256,
      };
    }
    writeJson(path.join(temporary, 'manifest.json'), {
      kind: 'lila.content-release',
      schemaVersion: 1,
      releaseId,
      games,
    });
    validateRelease(temporary);
    fs.renameSync(temporary, target);
  }
  activate(releasesRoot, releaseId);
  console.log(`content-release: release ${releaseId} publiée et activée`);
}

function validateRelease(releaseRoot) {
  const registryPath = path.join(
    backendRoot,
    'dist/game/composition/generated-game-registry.js',
  );
  if (!fs.existsSync(registryPath)) fail('backend compilé absent: exécuter npm run build');
  const result = require('node:child_process').spawnSync(
    process.execPath,
    ['-e', `require(${JSON.stringify(registryPath)})`],
    {
      env: { ...process.env, LILA_CONTENT_RELEASE_DIR: releaseRoot },
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) fail(`release rejetée par les schémas runtime: ${result.stderr.trim()}`);
}

function activate(releasesRoot, releaseId) {
  if (!/^[a-f0-9]{64}$/.test(releaseId)) fail('identifiant de release invalide');
  const target = path.join(releasesRoot, releaseId);
  if (!fs.statSync(target).isDirectory()) fail(`release inconnue: ${releaseId}`);
  const next = path.join(releasesRoot, `.current-${process.pid}`);
  const current = path.join(releasesRoot, 'current');
  fs.symlinkSync(releaseId, next, 'dir');
  fs.renameSync(next, current);
}

function safeId(value) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) fail(`identifiant de jeu invalide: ${value}`);
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function fail(message) {
  console.error(`content-release: ${message}`);
  process.exit(1);
}
