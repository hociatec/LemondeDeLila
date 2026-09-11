#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const assert = require('node:assert/strict');

const backlog = fs.readFileSync('corriger.txt', 'utf8');
const register = fs.readFileSync(
  'docs/quality/open-debt-register-2026-09-10.md',
  'utf8',
);
const open = [...backlog.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
const entries = [...register.matchAll(/^\| (\d+) \| ([^|]+) \| (.+?) \| ([^|]+) \| (open|in-progress|blocked) \| ([^|]+) \|$/gm)]
  .map((match) => ({
    id: Number(match[1]),
    owner: match[2].trim(),
    reason: match[3].trim(),
    target: match[4].trim(),
    state: match[5],
    exit: match[6].trim(),
  }));
assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length, 'Duplicate debt register IDs');
assert.deepEqual(entries.map((entry) => entry.id), open, 'Register must match corriger.txt exactly');
for (const entry of entries) {
  assert(entry.owner.length > 0, `Missing owner for ${entry.id}`);
  assert(entry.reason.length > 0, `Missing reason for ${entry.id}`);
  assert(entry.target === `backend/corriger.txt#${entry.id}`, `Invalid target for ${entry.id}`);
  assert(entry.state === 'open', `Unexpected state for ${entry.id}`);
  assert(entry.exit === 'proof documented and removal from corriger.txt', `Missing exit criterion for ${entry.id}`);
}
console.log(`backlog-governance-check: ${entries.length} open debts with owner/reason/target/state`);
