#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || 'backend-deployment.tar.gz');

function assertRequiredNodeMajor() {
  const required = String(process.env.BACKEND_ARTIFACT_NODE_MAJOR || '').trim();
  if (required === '') return;
  if (!/^\d+$/.test(required)) {
    throw new Error('BACKEND_ARTIFACT_NODE_MAJOR doit être un entier');
  }
  const actual = process.versions.node.split('.')[0];
  if (actual !== required) {
    throw new Error(
      `Artefact refusé sous Node ${process.version}; Node ${required} est requis`,
    );
  }
}

function requirePath(relative) {
  const target = path.join(backendRoot, relative);
  if (!fs.existsSync(target))
    throw new Error(`Élément d'artefact absent: ${relative}`);
  return target;
}

function sourceGitSha() {
  const fromEnvironment = String(process.env.GITHUB_SHA || '').trim();
  if (/^[a-f0-9]{40,64}$/.test(fromEnvironment)) return fromEnvironment;
  const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: backendRoot,
    encoding: 'utf8',
  });
  const sha = result.stdout.trim();
  if (result.status !== 0 || !/^[a-f0-9]{40,64}$/.test(sha)) {
    throw new Error('SHA Git source introuvable');
  }
  return sha;
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function listFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(target));
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(target);
  }
  return files;
}

const FORBIDDEN_ARTIFACT_DIRECTORY =
  /^(?:coverage|reports?|fixtures?|__fixtures__|__snapshots__|__tests__|tests?|specs?)$/i;

function isForbiddenArtifactEntry(relative, isDirectory) {
  const normalized = relative.replaceAll(path.sep, '/');
  const parts = normalized.split('/');
  const basename = parts.at(-1) || '';
  if (isDirectory && FORBIDDEN_ARTIFACT_DIRECTORY.test(basename)) return true;
  return (
    /(?:^|\/)\.env(?:\.|$)/i.test(normalized) ||
    /(?:^|\/)(?:id_rsa|id_ed25519|.*private.*key.*)$/i.test(normalized) ||
    /(?:^|\/).+\.(?:spec|test)\.(?:[cm]?js|json|map|d\.ts)$/i.test(normalized)
  );
}

function pruneProductionTree(root, current = root) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const target = path.join(current, entry.name);
    const relative = path.relative(root, target);
    if (isForbiddenArtifactEntry(relative, entry.isDirectory())) {
      fs.rmSync(target, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) pruneProductionTree(root, target);
  }
}

function assertProductionTree(root) {
  const forbidden = [];
  const inspect = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      const relative = path.relative(root, target);
      if (isForbiddenArtifactEntry(relative, entry.isDirectory())) {
        forbidden.push(relative.replaceAll(path.sep, '/'));
      } else if (entry.isDirectory()) {
        inspect(target);
      }
    }
  };
  inspect(root);
  if (forbidden.length > 0) {
    throw new Error(
      `L'artefact de production contient des fichiers inutiles:\n${forbidden
        .slice(0, 20)
        .join('\n')}`,
    );
  }
}

function assertProductionDist(dist) {
  const forbidden = listFiles(dist)
    .map((file) => path.relative(dist, file).replaceAll(path.sep, '/'))
    .filter(
      (file) =>
        /(^|\/)(?:coverage|reports?|fixtures?|__snapshots__)(\/|$)/i.test(
          file,
        ) ||
        /(?:^|\/).*\.(?:spec|test)\.js$/i.test(file) ||
        /(?:^|\/)\.env(?:\.|$)/i.test(file) ||
        /(?:^|\/)(?:id_rsa|id_ed25519|.*private.*key.*)$/i.test(file),
    );
  if (forbidden.length > 0) {
    throw new Error(
      `Le dist de production contient des fichiers interdits:\n${forbidden
        .slice(0, 20)
        .join('\n')}`,
    );
  }
}

function archiveArguments(output, staging) {
  const version = spawnSync('tar', ['--version'], { encoding: 'utf8' });
  if (version.status !== 0) throw new Error('Commande tar indisponible');
  if (/GNU tar/i.test(version.stdout))
    return [
      '--sort=name',
      '--mtime=UTC 1970-01-01',
      '--owner=0',
      '--group=0',
      '--numeric-owner',
      '-czf',
      output,
      '-C',
      staging,
      '.',
    ];
  return [
    '-czf',
    output,
    '--format',
    'ustar',
    '--mtime',
    '1970-01-01 00:00:00Z',
    '-C',
    staging,
    '.',
  ];
}

function main() {
  assertRequiredNodeMajor();
  const dist = requirePath('dist');
  requirePath('dist/main.js');
  assertProductionDist(dist);
  requirePath('node_modules');
  if (fs.existsSync(path.join(backendRoot, 'node_modules/jest'))) {
    throw new Error(
      'Les dépendances de développement doivent être retirées avec npm prune --omit=dev',
    );
  }
  const staging = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lila-backend-artifact-'),
  );
  try {
    const stagedBackend = path.join(staging, 'backend');
    fs.mkdirSync(stagedBackend);
    for (const entry of [
      'dist',
      'node_modules',
      'package.json',
      'package-lock.json',
    ]) {
      fs.cpSync(requirePath(entry), path.join(stagedBackend, entry), {
        recursive: true,
        dereference: false,
      });
    }
    pruneProductionTree(stagedBackend);
    assertProductionTree(stagedBackend);
    const manifest = {
      schemaVersion: 1,
      sourceGitSha: sourceGitSha(),
      nodeVersion: process.version,
      packageLockSha256: sha256(path.join(stagedBackend, 'package-lock.json')),
    };
    fs.writeFileSync(
      path.join(staging, '.backend-artifact.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const result = spawnSync('tar', archiveArguments(output, staging), {
      stdio: 'inherit',
    });
    if (result.status !== 0) throw new Error('Création tar impossible');
    const digest = sha256(output);
    fs.writeFileSync(`${output}.sha256`, `${digest}\n`);
    console.log(`deployment-artifact: ${output} sha256=${digest}`);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

if (require.main === module) main();

module.exports = {
  assertProductionTree,
  isForbiddenArtifactEntry,
  pruneProductionTree,
};
