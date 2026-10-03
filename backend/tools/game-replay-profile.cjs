#!/usr/bin/env node
/* eslint-disable no-console */
require('ts-node/register');
require('tsconfig-paths/register');
const fs = require('node:fs');
const path = require('node:path');
const { Session } = require('node:inspector');
const { promisify } = require('node:util');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');
const { Logger } = require('@nestjs/common');
const {
  discoverGameDefinitions,
} = require('../src/game/composition/game-module-discovery');
const {
  runGameReplayCampaign,
} = require('../src/game/testing/architecture-tests/game/game-replay-campaign');

async function main() {
  const gameId = process.argv[2] || 'gerard-president';
  const seed = Number(process.argv[3] || '65535');
  const maximumSteps = Number(process.argv[4] || '64');
  const runs = Math.max(
    1,
    Math.min(20, Number(process.env.GAME_PROFILE_RUNS || 3)),
  );
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Seed must be a uint32');
  if (
    !Number.isSafeInteger(maximumSteps) ||
    maximumSteps < 1 ||
    maximumSteps > 256
  )
    throw new Error('Steps must be between 1 and 256');
  const definition = discoverGameDefinitions().find(
    (item) => item.id === gameId,
  );
  if (!definition) throw new Error(`Unknown installed game: ${gameId}`);
  Logger.overrideLogger(false);
  const session = new Session();
  session.connect();
  const post = promisify(session.post.bind(session));
  const outputDirectory = path.resolve(__dirname, '../logs');
  fs.mkdirSync(outputDirectory, { recursive: true });
  let result;
  let elapsedMs;
  const samples = [];
  const memorySamples = [];
  const eventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
  const cpuBefore = process.cpuUsage();
  const memoryBefore = process.memoryUsage();
  try {
    eventLoopDelay.enable();
    await post('Profiler.enable');
    await post('Profiler.start');
    const startedAt = performance.now();
    try {
      for (let run = 0; run < runs; run += 1) {
        result = runGameReplayCampaign(
          definition,
          seed + run,
          maximumSteps,
          (sample) => samples.push(sample),
        );
        memorySamples.push(process.memoryUsage().heapUsed);
        // Give the delay histogram one event-loop turn between synchronous
        // replay bursts so it measures the blocking caused by the workload.
        await new Promise((resolve) => setImmediate(resolve));
      }
    } finally {
      elapsedMs = performance.now() - startedAt;
      const { profile } = await post('Profiler.stop');
      fs.writeFileSync(
        path.join(outputDirectory, 'game-replay.cpuprofile'),
        JSON.stringify(profile),
      );
      const summary = summarize(profile);
      const memoryAfter = process.memoryUsage();
      const cpu = process.cpuUsage(cpuBefore);
      const snapshotSizes = samples.map((sample) => sample.snapshotBytes);
      const commandTimes = samples.map((sample) => sample.commandMs);
      const timelineBytes = samples.reduce(
        (total, sample) => total + sample.appendedEventBytes,
        0,
      );
      const report = {
        gameId,
        seed,
        runs,
        maximumSteps,
        elapsedMs,
        result,
        certificationCounters: {
          compileJsonGame: discoverGameDefinitions().length,
          sessions: runs * 2,
          commands: samples.length * 2,
          replays: runs,
          simulations: runs,
          seeds: runs,
        },
        commands: {
          samples: commandTimes.length,
          p50Ms: percentile(commandTimes, 0.5),
          p95Ms: percentile(commandTimes, 0.95),
          p99Ms: percentile(commandTimes, 0.99),
        },
        snapshots: {
          averageBytes: average(snapshotSizes),
          maximumBytes: snapshotSizes.length ? Math.max(...snapshotSizes) : 0,
        },
        timeline: {
          events: samples.reduce(
            (total, sample) => total + sample.appendedEvents,
            0,
          ),
          totalBytes: timelineBytes,
          averageGrowthBytesPerCommand: samples.length
            ? timelineBytes / samples.length
            : 0,
        },
        cpu: { userMs: cpu.user / 1000, systemMs: cpu.system / 1000 },
        memory: {
          heapUsedBeforeBytes: memoryBefore.heapUsed,
          heapUsedAfterBytes: memoryAfter.heapUsed,
          heapUsedByRunBytes: memorySamples,
          finalDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
        },
        eventLoopDelayMs: {
          mean: nanosecondsToMilliseconds(eventLoopDelay.mean),
          p95: nanosecondsToMilliseconds(eventLoopDelay.percentile(95)),
          p99: nanosecondsToMilliseconds(eventLoopDelay.percentile(99)),
          maximum: nanosecondsToMilliseconds(eventLoopDelay.max),
        },
        hotFunctions: summary,
      };
      fs.writeFileSync(
        path.join(outputDirectory, 'game-replay-profile.json'),
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report, null, 2));
    }
  } finally {
    eventLoopDelay.disable();
    session.disconnect();
  }
}

function nanosecondsToMilliseconds(value) {
  return Number((Number.isFinite(value) ? value / 1e6 : 0).toFixed(3));
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return Number(
    ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)].toFixed(3),
  );
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function summarize(profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const times = new Map();
  for (const [index, id] of (profile.samples || []).entries()) {
    const frame = nodes.get(id)?.callFrame;
    if (!frame) continue;
    const key = `${frame.functionName || '(anonymous)'} ${frame.url}:${frame.lineNumber + 1}`;
    times.set(key, (times.get(key) || 0) + (profile.timeDeltas?.[index] || 0));
  }
  return [...times]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 30)
    .map(([frame, microseconds]) => ({ frame, selfMs: microseconds / 1000 }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
