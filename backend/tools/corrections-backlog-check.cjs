const fs = require('node:fs');
const assert = require('node:assert/strict');

const directory = 'docs/quality/';
const backlog = fs.readFileSync('corriger.txt', 'utf8');
const open = [...backlog.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
assert.equal(new Set(open).size, open.length, 'Duplicate backlog IDs');
assert(open.every((id, index) => id >= 1 && id <= 744 && (index === 0 || id > open[index - 1])), 'Original backlog IDs must remain ordered and within 1-744');
const snapshotHeader = 'Il reste encore ces points visibles dans ce snapshot :';
const isJsonSnapshot = /^Snapshot JSON complet :\r?\n/.test(backlog);
const isCurrentSnapshot = isJsonSnapshot || backlog.startsWith(`${snapshotHeader}\n`) || backlog.startsWith(`${snapshotHeader}\r\n`);
const numberedBody = isJsonSnapshot ? backlog.slice('Snapshot JSON complet :'.length) : isCurrentSnapshot ? backlog.slice(snapshotHeader.length) : backlog;
assert(isJsonSnapshot ? !numberedBody.trim() || /^\d+\. \S/.test(numberedBody.trim()) : numberedBody.split(/\r?\n/).every((line) => !line.trim() || /^\d+\. \S/.test(line)), 'Backlog must contain only unfinished numbered points');

// Historical reports reuse these IDs for different requirements. The current
// snapshot is reconciled with its own register, never with those old closures.
if (isCurrentSnapshot) {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'backlog-governance-check.cjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const reconciliation = { snapshot: 'current', openCount: open.length, retainedClosed: [] };
  fs.writeFileSync('logs/corrections-backlog-reconciliation.json', `${JSON.stringify(reconciliation, null, 2)}\n`);
  console.log(JSON.stringify({ open: open.length, ...reconciliation }, null, 2));
} else {

const closed = new Map();
function record(expression, source) {
  for (const match of expression.matchAll(/(\d+)(?:[\u2013\u2014-](\d+))?/g)) {
    const first = Number(match[1]);
    const last = Number(match[2] || first);
    assert(first > 0 && last <= 744 && last >= first);
    for (let id = first; id <= last; id += 1) {
      const sources = closed.get(id) || new Set();
      sources.add(source);
      closed.set(id, sources);
    }
  }
}

for (const file of ['corrections-lot-100-2026-09-08.md', 'corrections-lot-100-runtime-room-ws-2026-09-08.md', 'corrections-lot-100-patterns-caches-jobs-2026-09-08.md']) {
  for (const line of fs.readFileSync(directory + file, 'utf8').split('\n')) {
    const match = line.match(/^\| (\d+) \|/);
    if (match && /\| Clos(?: \||\s*$)/.test(line)) record(match[1], file);
  }
}
const jsonFile = 'corrections-lot-min100-2026-09-08.json';
const data = JSON.parse(fs.readFileSync(directory + jsonFile, 'utf8'));
assert.equal(data.status, 'validated');
for (const ids of Object.values(data.groups)) for (const id of ids) record(String(id), jsonFile);
for (const file of ['corrections-lot-100-boundaries-2026-09-08.md', 'corrections-lot-100-quotas-invariants-2026-09-08.md']) {
  const body = fs.readFileSync(directory + file, 'utf8');
  for (const match of body.matchAll(/^\| ([\d, \u2013-]+) \|/gm)) record(match[1], file);
}
record('1, 2, 3, 4, 5, 7, 9, 26, 28, 31, 40-43, 55-57, 59-62, 66-67, 72-73, 105, 112, 116, 121-122, 124-128, 130, 135, 144-145, 147-150, 157, 159-160', 'corrections-lot-100-engine-contracts-2026-09-10.md');
record('54', 'corrections-lot-text-parser-2026-09-10.md');
record('120', 'corrections-lot-distributed-locks-2026-09-10.md');
record('18', 'corrections-lot-naming-conventions-2026-09-10.md');
record('24', 'corrections-lot-panier-effects-2026-09-10.md');
record('20', 'corrections-lot-panier-content-2026-09-10.md');
record('22-23', 'corrections-lot-panier-wiring-2026-09-10.md');
record('44-52', 'corrections-lot-generic-game-sequences-2026-09-10.md');
record('21', 'corrections-lot-generic-game-sequences-2026-09-10.md');
record('53', 'corrections-lot-structured-content-2026-09-10.md');
record('33-34', 'corrections-lot-runtime-separation-2026-09-10.md');
record('155', 'corrections-lot-dead-code-2026-09-10.md');
record('30, 32, 35', 'corrections-lot-context-pattern-boundaries-2026-09-10.md');
record('152', 'corrections-lot-pass-through-services-2026-09-10.md');
record('153', 'corrections-lot-architecture-restraint-2026-09-10.md');
record('17', 'corrections-lot-state-naming-2026-09-10.md');
record('163', 'corrections-lot-json-only-game-2026-09-10.md');
record('133', 'corrections-lot-branded-identifiers-2026-09-10.md');
record('10-13', 'corrections-lot-messaging-contract-placement-2026-09-10.md');
record('19', 'corrections-lot-panier-surface-2026-09-10.md');
const lotFile = 'corrections-lot-100-quotas-invariants-2026-09-08.md';
const lot = fs.readFileSync(directory + lotFile, 'utf8');
const lotCount = [...closed.values()].filter((sources) => sources.has(lotFile)).length;
const lotHeader = lot.match(/\*\*(\d+) cl(?:ôtures|Ã´tures) sur les 100 vis(?:ées|Ã©es)/);
assert(lotHeader, 'Missing current lot counter');
assert.equal(Number(lotHeader[1]), lotCount, 'Lot report counter is stale');
const retainedClosed = open.filter((id) => closed.has(id));
console.log(JSON.stringify({ open: open.length, documentedClosed: closed.size, retainedClosed }, null, 2));
fs.writeFileSync('logs/corrections-backlog-reconciliation.json', `${JSON.stringify({ checkedAt: new Date().toISOString(), openCount: open.length, retainedClosed, closedEvidence: [...closed].sort((a, b) => a[0] - b[0]).map(([id, sources]) => ({ id, sources: [...sources] })) }, null, 2)}\n`);
assert.equal(retainedClosed.length, 0, 'Verified closed points remain in backlog');
}
