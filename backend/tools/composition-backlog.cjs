'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function reconcile(backlog, root) {
  const directory = path.join(root, 'docs/quality');
  const source = fs.readFileSync(
    path.join(directory, 'engine-composition-source-2026-09-24.md'),
    'utf8',
  );
  assert.equal(
    backlog.replaceAll('\r\n', '\n').trim(),
    source.replaceAll('\r\n', '\n').trim(),
    'Original composition audit must remain intact',
  );
  const ids = [...source.matchAll(/^(\d+)\. \*\*/gm)].map((match) =>
    Number(match[1]),
  );
  assert.deepEqual(
    ids,
    Array.from({ length: 44 }, (_, i) => i + 1),
  );
  const register = JSON.parse(
    fs.readFileSync(
      path.join(directory, 'engine-composition-register-2026-09-24.json'),
      'utf8',
    ),
  );
  assert.equal(register.snapshot, 'engine-composition-2026-09-24');
  assert.deepEqual(
    register.points.map((point) => point.id),
    ids,
    'Every original point needs its own entry',
  );
  const report = fs.readFileSync(
    path.join(directory, 'engine-composition-2026-09-24.md'),
    'utf8',
  );
  for (const point of register.points) {
    assert(['open', 'closed'].includes(point.status));
    if (point.status === 'open') continue;
    assert(
      report.includes(`## ${point.id}. `),
      `Missing evidence section ${point.id}`,
    );
    for (const kind of ['implementation', 'validation']) {
      assert(
        Array.isArray(point[kind]) && point[kind].length > 0,
        `Missing ${kind}: ${point.id}`,
      );
      for (const file of point[kind]) {
        const target = path.resolve(root, file);
        assert(
          target.startsWith(path.resolve(root) + path.sep),
          'Evidence outside repository',
        );
        assert(fs.statSync(target).isFile(), `Missing evidence: ${file}`);
      }
    }
  }
  const closed = register.points
    .filter((point) => point.status === 'closed')
    .map((point) => point.id);
  return {
    snapshot: register.snapshot,
    open: 44 - closed.length,
    openCount: 44 - closed.length,
    documentedClosed: closed.length,
    retainedClosed: closed,
  };
}
module.exports = { reconcile };
