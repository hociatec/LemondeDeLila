'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validatePromotion } = require('./effect-pack-promotion.cjs');
const root = path.resolve(__dirname, '..');
const policy = require('./engine-effect-pack-governance.json');
const suites = [];
for (const [name, profile] of Object.entries(policy.profiles)) {
  suites.push(
    ...(validatePromotion(name, profile, (relative) => {
      const file = path.resolve(root, relative);
      return (
        file.startsWith(root + path.sep) &&
        fs.existsSync(file) &&
        fs.readFileSync(file, 'utf8')
      );
    }) ?? []),
  );
}
if (suites.length) {
  const result = spawnSync(
    process.execPath,
    [
      require.resolve('jest/bin/jest'),
      '--runInBand',
      '--runTestsByPath',
      ...new Set(suites),
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else
  console.log(
    'Promotion contracts: no pack currently claims reuse or primitive status',
  );
