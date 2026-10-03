const fs = require('node:fs');
const path = require('node:path');
const { analyzeRuntime } = require('./runtime-dependency-graph.cjs');
const { engineExtensionDirectory } = require('./engine-extension-layout.cjs');
const { hasHigherLayerValueImport } = require('./runtime-contract-imports.cjs');

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
  violations.push(
    `runtime dependency cycle (including types): ${cycle.join(' -> ')}`,
  );
}
for (const chain of dependencyGraph.compilerDependencies) {
  violations.push(
    `execution reaches author compilation: ${chain.join(' -> ')}`,
  );
}
for (const file of files(path.join(runtime, 'contracts'))) {
  if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
  if (
    file.endsWith('-program.ts') &&
    path.basename(file) !== 'game-rule-program.ts'
  )
    violations.push(
      `${file}: single-consumer author program belongs in game/rules/engine-extensions`,
    );
  const source = fs.readFileSync(file, 'utf8');
  if (hasHigherLayerValueImport(source))
    violations.push(
      `${file}: runtime contract has a value dependency on a higher layer`,
    );
}
const engineExtensionsRoot = path.resolve('src/game/rules');
const engineExtensionPolicy = JSON.parse(
  fs.readFileSync(
    path.resolve('tools/engine-extension-governance.json'),
    'utf8',
  ),
);
const engineExtensions = Object.keys(engineExtensionPolicy.profiles).map((name) => ({
  name,
}));
for (const engineExtension of engineExtensions) {
  const directory = engineExtensionDirectory(
    engineExtensionsRoot,
    engineExtension.name,
    engineExtensionPolicy.profiles[engineExtension.name],
  );
  const entries = files(directory);
  const program = path.join(directory, 'program.ts');
  if (!entries.includes(program))
    violations.push(`${directory}: program.ts is missing`);
  const profile = engineExtensionPolicy.profiles[engineExtension.name];
  const implementation = path.join(directory, 'engine-extension.ts');
  if (profile?.property && !entries.includes(implementation))
    violations.push(`${directory}: engine-extension.ts is missing`);
  if (profile?.property && entries.includes(implementation)) {
    const implementationSource = fs.readFileSync(implementation, 'utf8');
    if (
      !['reusable', 'engine-primitive'].includes(
        profile.scope,
      ) ||
      !implementationSource.includes(`scope: '${profile.scope}'`)
    )
      violations.push(
        `${implementation}: engine-extension scope must match its reviewed classification`,
      );
    if (!implementationSource.includes(`domain: '${profile.domain}'`))
      violations.push(`${implementation}: engine-extension domain is incorrect`);
  }
  if (!entries.includes(program)) continue;
  const source = fs.readFileSync(program, 'utf8');
  if (
    [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].some(
      (match) =>
        path.resolve(directory, match[1]) !==
          path.resolve('src/game/engine/sdk/extension-contracts') &&
        !path
          .resolve(directory, match[1])
          .startsWith(path.join(runtime, 'contracts') + path.sep),
    )
  )
    violations.push(
      `${program}: engine-extension contract reaches outside low-level contracts`,
    );
}
for (const file of files(path.join(runtime, 'kits'))) {
  if (
    file.endsWith('.ts') &&
    /game-definition/.test(fs.readFileSync(file, 'utf8'))
  )
    violations.push(`${file}: kit depends on game definition`);
}
const declarative = path.join(runtime, 'declarative-game.runtime.ts');
if (/game-definition-compiler/.test(fs.readFileSync(declarative, 'utf8')))
  violations.push('declarative runtime imports compiler');
for (const file of files(path.join(runtime, 'patterns'))) {
  if (file.endsWith('.spec.ts')) continue;
  if (
    file.endsWith('.ts') &&
    /game-definition-(?:compiler|validator)/.test(fs.readFileSync(file, 'utf8'))
  )
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
  console.log(
    'Runtime separation audit: patterns use the authoring bridge and runtime is compiler-independent',
  );
}
