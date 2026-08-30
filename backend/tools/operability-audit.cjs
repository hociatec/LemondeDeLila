#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'src');
const backendRoot = path.resolve(__dirname, '..');
const contracts = [
  [
    'main.ts',
    /enableShutdownHooks\(\['SIGTERM', 'SIGINT'\]\)/,
    'shutdown hooks',
  ],
  ['main.ts', /runWithCorrelationId/, 'correlation HTTP'],
  [
    'platform/observability/infrastructure/logging/serv-logger.service.ts',
    /currentCorrelationId/,
    'correlation logs',
  ],
  [
    'platform/realtime/infrastructure/presentation/ws/realtime-api-handler.service.ts',
    /runWithCorrelationId/,
    'correlation WS API',
  ],
  [
    'modules/room/infrastructure/presentation/ws/room-gateway-command.service.ts',
    /runWithCorrelationId/,
    'correlation WS Room',
  ],
  [
    'modules/room/application/services/lifecycle/room-auto-cleanup.service.ts',
    /clearTimeout\(this\.initialTimer\)/,
    'Room initial cleanup shutdown',
  ],
  [
    'game/core/infrastructure/scheduling/bullmq-game-task-scheduler.service.ts',
    /correlationId[\s\S]*runWithCorrelationId|runWithCorrelationId[\s\S]*correlationId/,
    'correlation BullMQ',
  ],
  [
    'platform/pubsub/redis-pubsub.transport.ts',
    /CorrelatedPubSubEnvelope[\s\S]*runWithCorrelationId/,
    'correlation Redis PubSub',
  ],
  [
    'modules/health/infrastructure/presentation/http/controllers/health.controller.ts',
    /@Get\('live'\)/,
    'liveness',
  ],
  [
    'modules/health/infrastructure/presentation/http/controllers/health.controller.ts',
    /@Get\('ready'\)/,
    'readiness',
  ],
  [
    'game/core/application/services/game-engine-metrics.service.ts',
    /casConflicts/,
    'CAS metrics',
  ],
  [
    'game/core/application/services/game-engine-metrics.service.ts',
    /deadLettered/,
    'BullMQ metrics',
  ],
  [
    'game/core/infrastructure/persistence/typeorm/mysql-game-room-lock.service.ts',
    /game\.room_lock\.acquired/,
    'lock telemetry',
  ],
  [
    'modules/room/infrastructure/presentation/ws/room-gateway-command.service.ts',
    /extractTraceMeta/,
    'WS trace',
  ],
  [
    'platform/realtime/infrastructure/presentation/ws/realtime-api-connection.service.ts',
    /ws\.connection\.error/,
    'WS connection metrics',
  ],
  [
    'platform/realtime/infrastructure/presentation/ws/realtime-api-handler.service.ts',
    /ws\.reconnect\.replay/,
    'WS reconnect metrics',
  ],
  [
    'platform/ws/application/services/ws-api-hub.service.ts',
    /onModuleDestroy[\s\S]*terminate/,
    'WS graceful shutdown',
  ],
  [
    'modules/room/infrastructure/presentation/ws/room-gateway-runtime-state.service.ts',
    /onModuleDestroy[\s\S]*socket\.close\(1001[\s\S]*socket\.terminate/,
    'Room WS graceful shutdown',
  ],
  [
    'game/core/infrastructure/scheduling/bullmq-game-task-scheduler.service.ts',
    /onModuleDestroy/,
    'BullMQ graceful shutdown',
  ],
];

const violations = [];
for (const [name, pattern, label] of contracts) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  if (!pattern.test(source)) violations.push(`${name}: ${label} absent`);
}
const integrationSource = fs.readFileSync(
  path.join(backendRoot, 'tools/two-instance-real-e2e.cjs'),
  'utf8',
);
for (const [pattern, label] of [
  [/stopBackendsGracefully[\s\S]*SIGTERM/, 'test réel du graceful shutdown'],
  [
    /room\.toggle-privacy[\s\S]*room\.toggle-privacy/,
    'commandes Room concurrentes multi-instance',
  ],
  [
    /SELECT is_private AS isPrivate FROM rooms/,
    'assertion MySQL Room multi-instance',
  ],
]) {
  if (!pattern.test(integrationSource)) {
    violations.push(`tools/two-instance-real-e2e.cjs: ${label} absent`);
  }
}
if (violations.length) {
  console.error(`operability-audit: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`operability-audit: OK (${contracts.length} contrats)`);
}
