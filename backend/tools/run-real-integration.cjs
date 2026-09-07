#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const compose = path.join(__dirname, 'real-integration.compose.yml');
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const integrationEnv = {
  ...process.env,
  NODE_ENV: 'test',
  IGNORE_ENV_FILE: 'true',
  JWT_ALGORITHM: 'RS256',
  JWT_PRIVATE_KEY_PEM: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  JWT_PUBLIC_KEY_PEM: publicKey.export({ type: 'spki', format: 'pem' }),
  WS_TICKET_SECRET: 'real-integration-ws-secret-at-least-32-characters',
  DB_HOST: '127.0.0.1',
  DB_PORT: process.env.INTEGRATION_MYSQL_PORT ?? '33306',
  DB_USER: 'root',
  DB_PASSWORD: 'integration',
  DB_NAME: 'lmdl_integration',
  SESSION_STORE_REDIS_URL: `redis://127.0.0.1:${process.env.INTEGRATION_REDIS_PORT ?? '36379'}`,
  GAME_ENGINE_STATE_REDIS_URL: `redis://127.0.0.1:${process.env.INTEGRATION_REDIS_PORT ?? '36379'}`,
  GAME_TASK_REDIS_URL: `redis://127.0.0.1:${process.env.INTEGRATION_REDIS_PORT ?? '36379'}`,
  LOG_FILES_ENABLED: 'false',
};

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} a échoué`);
}

function succeeds(command, args, env = process.env) {
  return (
    spawnSync(command, args, {
      cwd: root,
      env,
      stdio: 'inherit',
    }).status === 0
  );
}

let nativeRedisDirectory = null;

function startDependencies() {
  if (succeeds('docker', ['compose', '-f', compose, 'up', '-d', '--wait'])) {
    return;
  }
  console.warn(
    'Compose simultané indisponible; nouvelle tentative avec MySQL Docker et Redis local isolé.',
  );
  run('docker', [
    'compose',
    '-f',
    compose,
    'down',
    '--volumes',
    '--remove-orphans',
  ]);
  run('docker', ['compose', '-f', compose, 'up', '-d', '--wait', 'mysql']);
  nativeRedisDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lmdl-real-integration-redis-'),
  );
  const port = process.env.INTEGRATION_REDIS_PORT ?? '36379';
  run('redis-server', [
    '--bind',
    '127.0.0.1',
    '--port',
    port,
    '--save',
    '',
    '--appendonly',
    'no',
    '--daemonize',
    'yes',
    '--pidfile',
    path.join(nativeRedisDirectory, 'redis.pid'),
    '--dir',
    nativeRedisDirectory,
  ]);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (succeeds('redis-cli', ['-p', port, 'ping'])) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error('Redis local d’intégration indisponible');
}

function stopNativeRedis() {
  if (!nativeRedisDirectory) return;
  const port = process.env.INTEGRATION_REDIS_PORT ?? '36379';
  succeeds('redis-cli', ['-p', port, 'shutdown', 'nosave']);
  fs.rmSync(nativeRedisDirectory, { recursive: true, force: true });
  nativeRedisDirectory = null;
}

try {
  startDependencies();
  run('npm', ['run', 'migration:run:dev'], integrationEnv);
  run('npm', ['run', 'test:db:migrations'], integrationEnv);
  run('npm', ['run', 'test:redis:bullmq'], integrationEnv);
  run('npm', ['run', 'test:disaster-recovery'], integrationEnv);
  run('npm', ['run', 'build'], integrationEnv);
  run('node', ['tools/two-instance-real-e2e.cjs'], integrationEnv);
  console.log(
    'real-integration: OK (MySQL, migrations, Redis, BullMQ, 2 backends, WS)',
  );
} finally {
  stopNativeRedis();
  run('docker', [
    'compose',
    '-f',
    compose,
    'down',
    '--volumes',
    '--remove-orphans',
  ]);
}
