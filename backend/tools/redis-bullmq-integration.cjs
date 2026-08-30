#!/usr/bin/env node
/* eslint-disable no-console */
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const redisUrl =
  process.env.GAME_TASK_REDIS_URL ??
  process.env.GAME_ENGINE_STATE_REDIS_URL ??
  process.env.SESSION_STORE_REDIS_URL ??
  'redis://127.0.0.1:6379';
const queueName = `integration-game-tasks-${process.pid}-${Date.now()}`;
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});
const queue = new Queue(queueName, { connection });
const workers = [];

async function waitFor(predicate, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Condition non atteinte après ${timeoutMs} ms`);
}

function worker(processor) {
  const instance = new Worker(queueName, processor, {
    connection,
    concurrency: 8,
  });
  workers.push(instance);
  return instance;
}

async function main() {
  await connection.ping();

  const delayedRuns = [];
  const delayedWorker = worker(async (job) => delayedRuns.push(job.id));
  const earliest = Date.now() + 250;
  await queue.add('delayed', {}, { jobId: 'delayed', delay: 250 });
  await waitFor(() => delayedRuns.length === 1);
  if (Date.now() < earliest - 30) throw new Error('Job delayed exécuté trop tôt');
  await delayedWorker.close();

  let attempts = 0;
  const retryWorker = worker(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('retry attendu');
  });
  await queue.add('retry', {}, {
    jobId: 'retry',
    attempts: 3,
    backoff: { type: 'fixed', delay: 20 },
  });
  await waitFor(async () => (await queue.getJob('retry'))?.isCompleted());
  if (attempts !== 3) throw new Error(`Nombre de retries invalide: ${attempts}`);
  await retryWorker.close();

  await queue.add('cancelled', {}, { jobId: 'cancelled', delay: 60_000 });
  const cancelled = await queue.getJob('cancelled');
  await cancelled.remove();
  if (await queue.getJob('cancelled')) throw new Error('Suppression BullMQ incomplète');

  await queue.add('restart', {}, { jobId: 'restart', delay: 100 });
  const stoppedWorker = worker(async () => undefined);
  await stoppedWorker.close();
  let restarted = 0;
  const restartedWorker = worker(async (job) => {
    if (job.id === 'restart') restarted += 1;
  });
  await waitFor(() => restarted === 1);
  await restartedWorker.close();

  let concurrentRuns = 0;
  const processConcurrent = async (job) => {
    if (job.id === 'shared') concurrentRuns += 1;
  };
  const first = worker(processConcurrent);
  const second = worker(processConcurrent);
  await queue.add('concurrent', {}, { jobId: 'shared' });
  await waitFor(async () => (await queue.getJob('shared'))?.isCompleted());
  if (concurrentRuns !== 1) {
    throw new Error(`Job partagé exécuté ${concurrentRuns} fois`);
  }
  await Promise.all([first.close(), second.close()]);

  console.log('redis-bullmq-integration: OK (delayed, retries, suppression, restart, concurrence)');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled(workers.map((instance) => instance.close()));
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
    await connection.quit();
  });
