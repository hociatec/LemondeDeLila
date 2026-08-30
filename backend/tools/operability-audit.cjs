#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'src');
const contracts = [
  ['main.ts', /enableShutdownHooks\(\['SIGTERM', 'SIGINT'\]\)/, 'shutdown hooks'],
  ['main.ts', /runWithCorrelationId/, 'correlation HTTP'],
  ['platform/observability/infrastructure/logging/serv-logger.service.ts', /currentCorrelationId/, 'correlation logs'],
  ['modules/health/infrastructure/presentation/http/controllers/health.controller.ts', /@Get\('live'\)/, 'liveness'],
  ['modules/health/infrastructure/presentation/http/controllers/health.controller.ts', /@Get\('ready'\)/, 'readiness'],
  ['game/core/application/services/game-engine-metrics.service.ts', /casConflicts/, 'CAS metrics'],
  ['game/core/application/services/game-engine-metrics.service.ts', /deadLettered/, 'BullMQ metrics'],
  ['game/core/infrastructure/persistence/typeorm/mysql-game-room-lock.service.ts', /game\.room_lock\.acquired/, 'lock telemetry'],
  ['modules/room/infrastructure/presentation/ws/room-gateway-command.service.ts', /extractTraceMeta/, 'WS trace'],
  ['platform/ws/application/services/ws-api-hub.service.ts', /onModuleDestroy/, 'WS graceful shutdown'],
  ['game/core/infrastructure/scheduling/bullmq-game-task-scheduler.service.ts', /onModuleDestroy/, 'BullMQ graceful shutdown'],
];

const violations = [];
for (const [name, pattern, label] of contracts) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  if (!pattern.test(source)) violations.push(`${name}: ${label} absent`);
}
if (violations.length) {
  console.error(`operability-audit: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`operability-audit: OK (${contracts.length} contrats)`);
}
