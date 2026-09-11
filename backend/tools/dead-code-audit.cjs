const { execFileSync } = require('node:child_process');

const tsc = require.resolve('typescript/bin/tsc');
execFileSync(process.execPath, [
  tsc,
  '-p',
  'tsconfig.build.json',
  '--noEmit',
  '--incremental',
  'false',
  '--noUnusedLocals',
  '--noUnusedParameters',
], { stdio: 'inherit' });
console.log('Dead code audit: no unused locals or parameters');
