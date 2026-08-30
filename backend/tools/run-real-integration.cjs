#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const compose = path.join(__dirname, 'real-integration.compose.yml');
const integrationEnv = {
  ...process.env,
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
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} a échoué`);
}

try {
  run('docker', ['compose', '-f', compose, 'up', '-d', '--wait']);
  run('npm', ['run', 'migration:run:dev'], integrationEnv);
  run('npm', ['run', 'test:db:migrations'], integrationEnv);
  run('npm', ['run', 'test:redis:bullmq'], integrationEnv);
  run('npm', ['run', 'build'], integrationEnv);
  run('node', ['tools/two-instance-real-e2e.cjs'], integrationEnv);
  console.log('real-integration: OK (MySQL, migrations, Redis, BullMQ, 2 backends, WS)');
} finally {
  run('docker', ['compose', '-f', compose, 'down', '--volumes', '--remove-orphans']);
}
