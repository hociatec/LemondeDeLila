#!/usr/bin/env node
/* eslint-disable no-console */
const { Queue, Worker } = require('bullmq');
const { spawn } = require('node:child_process');
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

function worker(processor, options = {}) {
  const instance = new Worker(queueName, processor, {
    connection,
    concurrency: 8,
    ...options,
  });
  workers.push(instance);
  return instance;
}

async function main() {
  await connection.ping();

  await queue.pause();
  const oldTimestamp = Date.now() - 5_000;
  await Promise.all([
    queue.add(
      'measured-depth',
      {},
      {
        jobId: 'job-depth-a',
        delay: 60_000,
        timestamp: oldTimestamp,
      },
    ),
    queue.add(
      'measured-depth',
      {},
      {
        jobId: 'job-depth-b',
        delay: 60_000,
      },
    ),
  ]);
  const measuredCounts = await queue.getJobCounts('waiting', 'delayed');
  const measuredJobs = await queue.getJobs(['waiting', 'delayed'], 0, 10, true);
  const oldestAgeMs =
    Date.now() - Math.min(...measuredJobs.map((job) => job.timestamp));
  if (measuredCounts.waiting + measuredCounts.delayed !== 2) {
    throw new Error(
      `Profondeur BullMQ invalide: ${JSON.stringify(measuredCounts)}`,
    );
  }
  if (oldestAgeMs < 4_500) {
    throw new Error(`Âge BullMQ invalide: ${oldestAgeMs}ms`);
  }
  await Promise.all(measuredJobs.map((job) => job.remove()));
  await queue.resume();

  const delayedRuns = [];
  const delayedWorker = worker(async (job) => delayedRuns.push(job.id));
  const earliest = Date.now() + 250;
  await queue.add('delayed', {}, { jobId: 'job-delayed', delay: 250 });
  await waitFor(() => delayedRuns.length === 1);
  if (Date.now() < earliest - 30)
    throw new Error('Job delayed exécuté trop tôt');
  await delayedWorker.close();

  let attempts = 0;
  const retryWorker = worker(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('retry attendu');
  });
  await queue.add(
    'retry',
    {},
    {
      jobId: 'job-retry',
      attempts: 3,
      backoff: { type: 'fixed', delay: 20 },
    },
  );
  await waitFor(async () => (await queue.getJob('job-retry'))?.isCompleted());
  if (attempts !== 3)
    throw new Error(`Nombre de retries invalide: ${attempts}`);
  await retryWorker.close();

  await queue.add('cancelled', {}, { jobId: 'job-cancelled', delay: 60_000 });
  const cancelled = await queue.getJob('job-cancelled');
  await cancelled.remove();
  if (await queue.getJob('job-cancelled')) {
    throw new Error('Suppression BullMQ incomplète');
  }

  await queue.add('restart', {}, { jobId: 'job-restart', delay: 100 });
  const stoppedWorker = worker(async () => undefined);
  await stoppedWorker.close();
  let restarted = 0;
  const restartedWorker = worker(async (job) => {
    if (job.id === 'job-restart') restarted += 1;
  });
  await waitFor(() => restarted === 1);
  await restartedWorker.close();

  const crashMarker = `${queueName}:crash-started`;
  const crashWorkerSource = `
    const { Worker } = require('bullmq');
    const Redis = require('ioredis');
    const connection = new Redis(process.env.CRASH_REDIS_URL, { maxRetriesPerRequest: null });
    new Worker(process.env.CRASH_QUEUE_NAME, async (job) => {
      if (job.id === 'job-worker-crash') {
        await connection.set(process.env.CRASH_MARKER, '1');
        await new Promise(() => undefined);
      }
    }, { connection, lockDuration: 500, stalledInterval: 250 });
  `;
  const crashedWorker = spawn(process.execPath, ['-e', crashWorkerSource], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CRASH_REDIS_URL: redisUrl,
      CRASH_QUEUE_NAME: queueName,
      CRASH_MARKER: crashMarker,
    },
    stdio: 'ignore',
  });
  await queue.add('worker-crash', {}, { jobId: 'job-worker-crash' });
  await waitFor(async () => (await connection.get(crashMarker)) === '1');
  const crashed = new Promise((resolve, reject) => {
    crashedWorker.once('close', resolve);
    crashedWorker.once('error', reject);
  });
  crashedWorker.kill('SIGKILL');
  await crashed;
  await new Promise((resolve) => setTimeout(resolve, 750));
  await connection.del(queue.toKey('stalled-check'));
  let recoveredAfterCrash = 0;
  const crashRecoveryWorker = worker(
    async (job) => {
      if (job.id === 'job-worker-crash') recoveredAfterCrash += 1;
    },
    { lockDuration: 500, stalledInterval: 250 },
  );
  await waitFor(
    async () => (await queue.getJob('job-worker-crash'))?.isCompleted(),
    20_000,
  );
  if (recoveredAfterCrash !== 1) {
    throw new Error(`Reprise après crash invalide: ${recoveredAfterCrash}`);
  }
  await crashRecoveryWorker.close();
  await connection.del(crashMarker);

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

  const duplicateDeliveries = [];
  const duplicateWorker = worker(async (job) => {
    if (job.data.commandId === 'same-command') duplicateDeliveries.push(job.id);
  });
  await Promise.all([
    queue.add(
      'duplicate-delivery',
      { commandId: 'same-command' },
      { jobId: 'duplicate-delivery-a' },
    ),
    queue.add(
      'duplicate-delivery',
      { commandId: 'same-command' },
      { jobId: 'duplicate-delivery-b' },
    ),
  ]);
  await waitFor(() => duplicateDeliveries.length === 2);
  if (new Set(duplicateDeliveries).size !== 2) {
    throw new Error('Double livraison BullMQ non observée');
  }
  await duplicateWorker.close();

  console.log(
    `redis-bullmq-integration: OK (depth=${measuredCounts.waiting + measuredCounts.delayed}, oldestAgeMs=${oldestAgeMs}, delayed, retries, crash/reprise, suppression, restart, concurrence, double livraison)`,
  );
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
