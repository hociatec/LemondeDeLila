#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */

const { spawnSync } = require('node:child_process');

const SERVICE_RE = /^[a-zA-Z0-9@._-]+$/;
const DEFAULT_SERVICES = ['lila-backend'];

function printHelp() {
  console.log('Usage:');
  console.log('  npm run service:restart');
  console.log('  npm run service:restart -- lila-backend');
  console.log('  npm run service:restart -- --services=lila-backend,lila-realtime');
  console.log('');
  console.log('Notes:');
  console.log('- Requiert des droits systemd (souvent via sudo).');
  console.log('- Les services inconnus/absents échoueront.');
}

function hasRoot() {
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.error) {
    console.error(`Erreur en lançant ${cmd}:`, result.error.message);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function canSudoNonInteractive() {
  const result = spawnSync('sudo', ['-n', 'true'], { stdio: 'ignore' });
  return result.status === 0;
}

function systemctl(args) {
  if (hasRoot()) return run('systemctl', args);
  if (!canSudoNonInteractive()) {
    console.error('Ce script doit être lancé avec sudo (ex: `sudo npm run service:restart`).');
    return 1;
  }
  return run('sudo', ['-n', 'systemctl', ...args]);
}

function parseServices(argv) {
  const services = [];
  for (const arg of argv) {
    if (!arg) continue;
    if (arg === '--services' || arg === '-s') continue;
    if (arg.startsWith('--services=')) {
      const raw = arg.slice('--services='.length);
      services.push(
        ...raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
      continue;
    }
    if (arg.startsWith('-')) continue;
    services.push(arg.trim());
  }
  return services.length > 0 ? services : DEFAULT_SERVICES;
}

function validateServiceName(name) {
  if (!SERVICE_RE.test(name)) return false;
  if (name.includes('..') || name.includes('/')) return false;
  return true;
}

function normalizeServiceName(name) {
  const trimmed = String(name).trim();
  return trimmed.endsWith('.service') ? trimmed : trimmed;
}

function restartAndStatus(service) {
  console.log(`\n==> Restart: ${service}`);
  const restartCode = systemctl(['restart', service]);
  if (restartCode !== 0) return restartCode;
  return systemctl(['--no-pager', '--full', '-l', 'status', service]);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const services = parseServices(argv).map(normalizeServiceName);
  for (const s of services) {
    if (!validateServiceName(s)) {
      console.error(`Nom de service invalide: "${s}"`);
      process.exitCode = 2;
      return;
    }
  }

  let exitCode = 0;
  for (const service of services) {
    const code = restartAndStatus(service);
    if (code !== 0) exitCode = code;
  }
  process.exitCode = exitCode;
}

main();

