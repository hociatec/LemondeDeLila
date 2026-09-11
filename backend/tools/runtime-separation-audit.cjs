const fs = require('node:fs');
const path = require('node:path');
const { analyzeRuntime } = require('./runtime-dependency-graph.cjs');

const violations = [];
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
const runtime = path.resolve('src/game/engine/runtime');
const dependencyGraph = analyzeRuntime(runtime);
for (const cycle of dependencyGraph.cycles) {
  violations.push(`runtime dependency cycle (including types): ${cycle.join(' -> ')}`);
}
for (const chain of dependencyGraph.compilerDependencies) {
  violations.push(`execution reaches author compilation: ${chain.join(' -> ')}`);
}
for (const file of files(path.join(runtime, 'kits'))) {
  if (file.endsWith('.ts') && /game-definition/.test(fs.readFileSync(file, 'utf8')))
    violations.push(`${file}: kit depends on game definition`);
}
const declarative = path.join(runtime, 'declarative-game.runtime.ts');
if (/game-definition-compiler/.test(fs.readFileSync(declarative, 'utf8')))
  violations.push('declarative runtime imports compiler');
for (const file of files(path.join(runtime, 'patterns'))) {
  if (file.endsWith('.spec.ts')) continue;
  if (file.endsWith('.ts') && /game-definition-(?:compiler|validator)/.test(fs.readFileSync(file, 'utf8')))
    violations.push(`${file}: pattern depends on compiler or validator`);
  if (
    file.endsWith('.ts') &&
    !file.endsWith('pattern-capabilities.ts') &&
    /from ['"]\.\.\/(?:kits|lifecycle|cards|effects|recipes|configuration)\//.test(
      fs.readFileSync(file, 'utf8'),
    )
  ) {
    violations.push(`${file}: pattern reaches runtime capability directly`);
  }
}
if (violations.length) {
  console.error(`Runtime separation audit failed: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Runtime separation audit: patterns use the authoring bridge and runtime is compiler-independent');
}
