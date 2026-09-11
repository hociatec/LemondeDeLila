const assert = require('node:assert/strict');
const test = require('node:test');
const { analyze, longestPath } = require('./service-call-depth-check.cjs');

test('measures dependency call depth and ignores cycles', () => {
  const files = [
    { file: 'a.ts', source: 'class A { constructor(private readonly b: B) {} run() { return this.b.run(); } }' },
    { file: 'b.ts', source: 'class B { constructor(private readonly c: C) {} run() { return this.c.run(); } }' },
    { file: 'c.ts', source: 'class C { run() { return 1; } }' },
  ];
  assert.equal(analyze({ files }).maxDepth, 3);
  assert.equal(longestPath(new Map([['A', new Set(['B'])], ['B', new Set(['A'])]])), 2);
});
