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
  requirePath('dist/main.js');
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

main();
