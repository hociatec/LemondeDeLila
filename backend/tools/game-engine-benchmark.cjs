#!/usr/bin/env node
/* eslint-disable no-console */
require('ts-node/register');
require('tsconfig-paths/register');

const { performance } = require('node:perf_hooks');
const { Logger } = require('@nestjs/common');
const {
  discoverGameDefinitions,
} = require('../src/game/composition/game-module-discovery');
const {
  auditGameDefinition,
} = require('../src/game/testing/architecture-tests/game/game-contract-auditor');

const iterations = Math.max(
  1,
  Math.min(20, Number(process.env.GAME_BENCHMARK_ITERATIONS || 3)),
);
const maximumAverageMs = Number(
  process.env.GAME_BENCHMARK_MAX_AVERAGE_MS || 0,
);
Logger.overrideLogger(false);

async function main() {
  const definitions = discoverGameDefinitions();
  if (definitions.length === 0) throw new Error('Aucun jeu découvert');

  // Warm-up excludes TypeScript/module initialization from the measured runs.
  await auditAll(definitions);
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    await auditAll(definitions);
    samples.push(performance.now() - startedAt);
  }
  const averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const result = {
    games: definitions.length,
    iterations,
    averageMs: Number(averageMs.toFixed(2)),
    minMs: Number(Math.min(...samples).toFixed(2)),
    maxMs: Number(Math.max(...samples).toFixed(2)),
  };
  console.log(JSON.stringify(result));
  if (maximumAverageMs > 0 && averageMs > maximumAverageMs) {
    throw new Error(
      `Régression benchmark: ${averageMs.toFixed(2)}ms > ${maximumAverageMs}ms`,
    );
  }
}

async function auditAll(definitions) {
  for (const definition of definitions) {
    const failures = await auditGameDefinition(definition);
    if (failures.length > 0) {
      throw new Error(`${definition.id}: ${failures.join('; ')}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
