#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const contract = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'backend-debt-contract.json'), 'utf8'),
);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const files = walk(src).filter(
  (file) =>
    file.endsWith('.ts') &&
    !file.endsWith('.spec.ts') &&
    !file.endsWith('.test.ts') &&
    !file.includes(`${path.sep}tests${path.sep}`) &&
    !file.includes(`${path.sep}migrations${path.sep}`),
);
const sources = files.map((file) => ({
  file,
  relative: path.relative(root, file).split(path.sep).join('/'),
  source: fs.readFileSync(file, 'utf8'),
}));
const violations = [];
let explicitAny = 0;
let unjustifiedEmptyCatches = 0;

const environmentFile = path.join(root, '.env');
if (fs.existsSync(environmentFile)) {
  const unsafePermissions = fs.statSync(environmentFile).mode & 0o077;
  if (unsafePermissions !== 0) {
    violations.push('.env: permissions groupe/autres interdites (attendu 600)');
  }
}

const trackedResult = spawnSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
});
if (trackedResult.status === 0) {
  const trackedArtifacts = trackedResult.stdout
    .split('\0')
    .filter(Boolean)
    .filter(
      (file) =>
        file.startsWith('coverage/') ||
        /^\.tmp-eslint-.*\.json$/.test(file),
    );
  if (trackedArtifacts.length > 0) {
    violations.push(
      `artefacts runtime/générés suivis par Git: ${trackedArtifacts.length}`,
    );
  }
}

for (const item of sources) {
  if (/@deprecated\b/.test(item.source)) {
    violations.push(`${item.relative}: API dépréciée`);
  }
  if (/pg_advisory|pg_try_advisory|::jsonb/i.test(item.source)) {
    violations.push(`${item.relative}: SQL PostgreSQL interdit`);
  }
  if (/\.query\s*\(\s*`[^`]*\$\{/s.test(item.source)) {
    violations.push(
      `${item.relative}: interpolation dans une requête SQL brute`,
    );
  }

  const sourceFile = ts.createSourceFile(
    item.file,
    item.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) explicitAny += 1;
    if (ts.isCatchClause(node) && node.block.statements.length === 0) {
      const justification = node.block.getText(sourceFile).slice(1, -1).trim();
      if (!justification) unjustifiedEmptyCatches += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const silentPromiseCatches = sources.reduce(
  (count, item) =>
    count +
    (item.source.match(/\.catch\(\(\)\s*=>\s*(?:undefined|\{\})\)/g)?.length ??
      0),
  0,
);
const directProcessEnv = sources.reduce(
  (count, item) => count + (item.source.match(/process\.env/g)?.length ?? 0),
  0,
);
if (silentPromiseCatches > contract.ceilings.silentPromiseCatches) {
  violations.push(
    `catch Promise silencieux: ${silentPromiseCatches} > ${contract.ceilings.silentPromiseCatches}`,
  );
}
if (directProcessEnv > contract.ceilings.directProcessEnv) {
  violations.push(
    `process.env directs: ${directProcessEnv} > ${contract.ceilings.directProcessEnv}`,
  );
}
if (explicitAny > contract.ceilings.explicitAny) {
  violations.push(
    `types any explicites en production: ${explicitAny} > ${contract.ceilings.explicitAny}`,
  );
}
if (unjustifiedEmptyCatches > contract.ceilings.unjustifiedEmptyCatches) {
  violations.push(
    `catch vides sans justification: ${unjustifiedEmptyCatches} > ${contract.ceilings.unjustifiedEmptyCatches}`,
  );
}

for (const component of contract.requiredLocalSpecs) {
  const componentRoot = path.join(src, component);
  const hasSpec = walk(componentRoot).some((file) => file.endsWith('.spec.ts'));
  if (!hasSpec) violations.push(`${component}: aucun test local`);
}
for (const document of contract.requiredDocuments) {
  if (!fs.existsSync(path.join(root, document))) {
    violations.push(`${document}: document requis absent`);
  }
}

console.log(
  `backend-debt-check: ${files.length} fichiers, silentPromiseCatches=${silentPromiseCatches}, directProcessEnv=${directProcessEnv}, explicitAny=${explicitAny}, unjustifiedEmptyCatches=${unjustifiedEmptyCatches}`,
);
if (violations.length > 0) {
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('backend-debt-check: OK');
}
