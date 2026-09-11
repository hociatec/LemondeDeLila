#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('src');
const violations = [];
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
for (const file of walk(root)) {
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  const match = relative.match(/\/application\/contracts\/([^/]+(?:\.(?:model|record|input|interface)|\.repository)\.ts)$/);
  if (!match) continue;
  const source = fs.readFileSync(file, 'utf8');
  violations.push(`${relative}: data model or port remains in contracts${source.includes('export *') ? ' through a forwarding file' : ''}`);
}
if (violations.length) {
  console.error(`Application contract placement audit failed: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Application contract placement audit: role-oriented definitions');
}
