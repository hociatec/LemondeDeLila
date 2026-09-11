#!/usr/bin/env node
/* eslint-disable no-console */
require('ts-node/register');
require('tsconfig-paths/register');
const fs = require('node:fs');
const path = require('node:path');
const { Session } = require('node:inspector');
const { promisify } = require('node:util');
const { performance } = require('node:perf_hooks');
const { Logger } = require('@nestjs/common');
const { discoverGameDefinitions } = require('../src/game/composition/game-module-discovery');
const { runGameReplayCampaign } = require('../src/game/testing/architecture-tests/game/game-replay-campaign');

async function main() {
  const gameId = process.argv[2] || 'gerard-president';
  const seed = Number(process.argv[3] || '65535');
  const maximumSteps = Number(process.argv[4] || '64');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  if (!Number.isSafeInteger(maximumSteps) || maximumSteps < 1 || maximumSteps > 256) throw new Error('Steps must be between 1 and 256');
  const definition = discoverGameDefinitions().find(item => item.id === gameId);
  if (!definition) throw new Error(`Unknown installed game: ${gameId}`);
  Logger.overrideLogger(false);
  const session = new Session();
  session.connect();
  const post = promisify(session.post.bind(session));
  const outputDirectory = path.resolve(__dirname, '../logs');
  fs.mkdirSync(outputDirectory, { recursive: true });
  let result;
  let elapsedMs;
  try {
    await post('Profiler.enable');
    await post('Profiler.start');
    const startedAt = performance.now();
    try {
      result = runGameReplayCampaign(definition, seed, maximumSteps);
    } finally {
      elapsedMs = performance.now() - startedAt;
      const { profile } = await post('Profiler.stop');
      fs.writeFileSync(path.join(outputDirectory, 'game-replay.cpuprofile'), JSON.stringify(profile));
      const summary = summarize(profile);
      const report = { gameId, seed, maximumSteps, elapsedMs, result, hotFunctions: summary };
      fs.writeFileSync(path.join(outputDirectory, 'game-replay-profile.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report, null, 2));
    }
  } finally {
    session.disconnect();
  }
}

function summarize(profile) {
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const times = new Map();
  for (const [index, id] of (profile.samples || []).entries()) {
    const frame = nodes.get(id)?.callFrame;
    if (!frame) continue;
    const key = `${frame.functionName || '(anonymous)'} ${frame.url}:${frame.lineNumber + 1}`;
    times.set(key, (times.get(key) || 0) + (profile.timeDeltas?.[index] || 0));
  }
  return [...times].sort((left, right) => right[1] - left[1]).slice(0, 30)
    .map(([frame, microseconds]) => ({ frame, selfMs: microseconds / 1000 }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
