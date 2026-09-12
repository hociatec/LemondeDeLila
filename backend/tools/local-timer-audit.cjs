#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const allowedCalls = new Map([
  // Recovery poll only: durable intent is the SQL session, never the local timer.
  ['game/core/infrastructure/scheduling/game-automation-recovery.service.ts', 1],
  // Transport shutdown: bounded close handshake before forced termination.
  ['platform/ws/infrastructure/platform/lila-ws.adapter.ts', 1],
  [
    'modules/admin/infrastructure/system/admin-maintenance-runtime.service.ts',
    1,
  ],
  [
    'modules/notification/infrastructure/presentation/ws/notification-ws-connection.service.ts',
    1,
  ],
  [
    'modules/notification/infrastructure/presentation/ws/notification-ws.handler.ts',
    1,
  ],
  ['modules/presence/application/services/presence-heartbeat.ts', 2],
  ['platform/ws/application/services/ws-api-hub.service.ts', 1],
  [
    'modules/room/application/services/lifecycle/room-auto-cleanup.service.ts',
    2,
  ],
  ['modules/room/application/services/lobby/room-lobby-refresh.service.ts', 1],
  [
    'modules/room/infrastructure/presentation/ws/room-gateway-presence.service.ts',
    1,
  ],
  ['modules/room/infrastructure/presentation/ws/room-heartbeat.helpers.ts', 1],
  [
    'modules/room/infrastructure/presentation/ws/room-gateway-runtime-state.service.ts',
    1,
  ],
  // Process deadline and bounded admission wait; neither represents durable work.
  // Admission timers are cleared on grant and remove their waiter on expiry.
  ['modules/sounds/infrastructure/storage/sounds-audio-process.ts', 2],
  // Readiness I/O deadline: 2 seconds, cleared in finally; no durable business task.
  ['modules/health/infrastructure/checks/health-check-timeout.ts', 1],
  // Windows atomic rename: at most five waits, 150 ms total, no business replay.
  ['platform/filesystem/infrastructure/atomic-file.utils.ts', 1],
  // Redis lease renewal: local handle for a distributed PEXPIRE heartbeat.
  ['platform/redis/infrastructure/redis-distributed-lease.service.ts', 1],
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function timerCallCount(file) {
  const parsed = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let count = 0;
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ['setTimeout', 'setInterval'].includes(node.expression.text)
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return count;
}

const actual = new Map();
for (const file of walk(src)) {
  if (!file.endsWith('.ts') || /\.(?:spec|test)\.ts$/.test(file)) continue;
  const count = timerCallCount(file);
  if (count > 0) {
    actual.set(path.relative(src, file).replaceAll(path.sep, '/'), count);
  }
}

const violations = [];
for (const [file, count] of actual) {
  const expected = allowedCalls.get(file);
  if (expected == null)
    violations.push(`${file}: timer local non classé (${count})`);
  else if (expected !== count) {
    violations.push(`${file}: ${count} timers, attendu ${expected}`);
  }
}
for (const [file, expected] of allowedCalls) {
  if (!actual.has(file)) {
    violations.push(`${file}: exception obsolète (attendu ${expected})`);
  }
}

if (violations.length > 0) {
  console.error(`local-timer-audit: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  const count = [...actual.values()].reduce((total, value) => total + value, 0);
  console.log(
    `local-timer-audit: OK (${actual.size} propriétaires, ${count} timers)`,
  );
}
