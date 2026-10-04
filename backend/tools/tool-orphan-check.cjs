#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const trackedFiles = execFileSync(
  'git',
  ['-C', repositoryRoot, 'ls-files', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const toolFiles = trackedFiles.filter((file) => file.startsWith('backend/tools/'));
const searchable = trackedFiles.flatMap((file) => {
  const absolute = path.join(repositoryRoot, file);
  try {
    const content = fs.readFileSync(absolute, 'utf8');
    return content.includes('\0') ? [] : [{ file, content }];
  } catch {
    return [];
  }
});

const orphans = toolFiles.filter((toolFile) => {
  const name = path.basename(toolFile);
  return !searchable.some(
    ({ file, content }) => file !== toolFile && content.includes(name),
  );
});

if (orphans.length > 0) {
  for (const file of orphans) process.stderr.write(`Outil orphelin : ${file}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `tool-orphan-check: ${toolFiles.length} fichiers suivis, 0 orphelin.\n`,
  );
}
