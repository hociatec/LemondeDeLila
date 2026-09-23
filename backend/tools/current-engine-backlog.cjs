'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function isEngineAudit(backlog) {
  return (
    backlog.startsWith('J’ai repris l’archive') &&
    backlog.includes('## A. Généricité et architecture')
  );
}

function reconcileEngineAudit(backlog, root = process.cwd()) {
  const register = JSON.parse(
    fs.readFileSync(
      path.join(root, 'docs/quality/engine-audit-register-2026-09-23.json'),
      'utf8',
    ),
  );
  assert.equal(register.snapshot, 'engine-audit-2026-09-23');
  const open = [...backlog.matchAll(/^\*\*(\d+)\. /gm)].map((match) =>
    Number(match[1]),
  );
  assert.equal(new Set(open).size, open.length, 'Duplicate backlog IDs');
  assert(
    open.every(
      (id, index) =>
        id >= 1 && id <= 36 && (index === 0 || id > open[index - 1]),
    ),
    'Original backlog IDs must remain ordered and within 1-36',
  );
  assert.deepEqual(
    register.points.map((point) => point.id),
    Array.from({ length: 36 }, (_, index) => index + 1),
    'Register must preserve all original IDs',
  );
  assert.deepEqual(
    register.points
      .filter((point) => point.status === 'open')
      .map((point) => point.id),
    open,
    'Register must match corriger.txt exactly',
  );
  for (const point of register.points) {
    assert(
      ['open', 'closed'].includes(point.status),
      `Invalid status for ${point.id}`,
    );
    if (point.status !== 'closed') continue;
    assert.equal(
      typeof point.evidence,
      'string',
      `Missing closure evidence for ${point.id}`,
    );
    const evidence = path.resolve(root, point.evidence);
    assert(
      evidence.startsWith(path.resolve(root, 'docs/quality') + path.sep),
      'Closure evidence must belong to docs/quality',
    );
    assert(
      fs.readFileSync(evidence, 'utf8').trim().length >= 120,
      `Empty closure evidence for ${point.id}`,
    );
  }
  return {
    snapshot: register.snapshot,
    open: open.length,
    openCount: open.length,
    documentedClosed: register.points.length - open.length,
    retainedClosed: [],
  };
}
module.exports = { isEngineAudit, reconcileEngineAudit };
