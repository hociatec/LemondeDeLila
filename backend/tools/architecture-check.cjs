#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');
const baselineFile = path.join(__dirname, 'architecture-baseline.json');

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update-baseline');

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORED_SUFFIXES = ['.spec.ts', '.e2e-spec.ts', '.d.ts'];
const IMPORT_RE = /\b(?:import|export)\b[\s\S]*?\bfrom\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const LEGACY_ROOT_DIRS = new Set(['entities', 'dto', 'gateways', 'services', 'ws']);
const LEGACY_ROOT_DOMAIN_EXCLUSIONS = new Set(['common', 'database', 'migrations', 'types']);

function isSourceFile(filePath) {
  return (
    SOURCE_EXTENSIONS.includes(path.extname(filePath)) &&
    !IGNORED_SUFFIXES.some((suffix) => filePath.endsWith(suffix))
  );
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (isSourceFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function toRepoRelative(filePath) {
  return normalizeSlashes(path.relative(repoRoot, filePath));
}

function toSrcRelative(filePath) {
  return normalizeSlashes(path.relative(srcRoot, filePath));
}

function getDomainName(filePath) {
  const srcRelative = toSrcRelative(filePath);
  const [domain] = srcRelative.split('/');
  return domain || null;
}

function getLayer(filePath) {
  const srcRelative = toSrcRelative(filePath);
  const [, layer] = srcRelative.split('/');
  return layer || null;
}

function resolveImport(fromFile, specifier) {
  if (specifier.startsWith('.')) {
    const basePath = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [
      basePath,
      ...SOURCE_EXTENSIONS.map((ext) => `${basePath}${ext}`),
      ...SOURCE_EXTENSIONS.map((ext) => path.join(basePath, `index${ext}`)),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
    return null;
  }

  if (specifier.startsWith('@common/')) {
    const basePath = path.join(srcRoot, 'common', specifier.slice('@common/'.length));
    const candidates = [
      basePath,
      ...SOURCE_EXTENSIONS.map((ext) => `${basePath}${ext}`),
      ...SOURCE_EXTENSIONS.map((ext) => path.join(basePath, `index${ext}`)),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  }

  return null;
}

function getImports(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] || match[2];
    if (!specifier) continue;
    imports.push({
      specifier,
      resolved: resolveImport(filePath, specifier),
    });
  }
  return imports;
}

function isPublicApiTarget(targetFile) {
  const base = path.basename(targetFile);
  return base === 'index.ts' || base === 'public-api.ts';
}

function createViolation(rule, fromFile, detail) {
  return {
    rule,
    file: toRepoRelative(fromFile),
    detail,
  };
}

function createCycleViolation(cycleDomains) {
  return {
    rule: 'domain-cycle',
    file: '(domain-graph)',
    detail: cycleDomains.join(' -> '),
  };
}

function createLegacyRootViolation(fromFile, legacyDir) {
  return {
    rule: 'legacy-root-structure',
    file: toRepoRelative(fromFile),
    detail: `stored under legacy root directory "${legacyDir}"`,
  };
}

function sortViolations(violations) {
  return [...violations].sort((a, b) => {
    if (a.rule !== b.rule) return a.rule.localeCompare(b.rule);
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.detail.localeCompare(b.detail);
  });
}

function violationKey(violation) {
  return `${violation.rule}::${violation.file}::${violation.detail}`;
}

function detectCycles(domainGraph) {
  const domains = [...domainGraph.keys()].sort();
  const seen = new Set();
  const cycles = new Set();

  function dfs(start, current, stack) {
    const edges = [...(domainGraph.get(current) || [])].sort();
    for (const next of edges) {
      if (next === start) {
        cycles.add([...stack, start].join(' -> '));
        continue;
      }
      if (stack.includes(next)) continue;
      dfs(start, next, [...stack, next]);
    }
  }

  for (const domain of domains) {
    if (seen.has(domain)) continue;
    dfs(domain, domain, [domain]);
    seen.add(domain);
  }

  return [...cycles]
    .map((cycle) => cycle.split(' -> '))
    .sort((a, b) => a.join(' -> ').localeCompare(b.join(' -> ')));
}

function loadBaseline() {
  if (!fs.existsSync(baselineFile)) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  return Array.isArray(parsed.violations) ? parsed.violations : [];
}

function saveBaseline(violations) {
  const payload = {
    generatedAt: new Date().toISOString(),
    violations: sortViolations(violations),
  };
  fs.writeFileSync(`${baselineFile}`, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

const files = walk(srcRoot);
const violations = [];
const domainGraph = new Map();

for (const filePath of files) {
  const currentDomain = getDomainName(filePath);
  const layer = getLayer(filePath);
  if (!currentDomain) continue;

  if (!LEGACY_ROOT_DOMAIN_EXCLUSIONS.has(currentDomain)) {
    const srcRelative = toSrcRelative(filePath);
    const [, maybeLegacyDir] = srcRelative.split('/');
    if (LEGACY_ROOT_DIRS.has(maybeLegacyDir)) {
      violations.push(createLegacyRootViolation(filePath, maybeLegacyDir));
    }
  }

  if (!domainGraph.has(currentDomain)) {
    domainGraph.set(currentDomain, new Set());
  }

  for (const entry of getImports(filePath)) {
    const { specifier, resolved } = entry;

    if (layer === 'application') {
      if (specifier === 'typeorm' || specifier.startsWith('@nestjs/typeorm')) {
        violations.push(
          createViolation(
            'application-no-typeorm',
            filePath,
            `imports ${specifier}`,
          ),
        );
      }
      if (resolved && getLayer(resolved) === 'infrastructure') {
        violations.push(
          createViolation(
            'application-no-infrastructure',
            filePath,
            `imports ${toRepoRelative(resolved)}`,
          ),
        );
      }
    }

    if (layer === 'domain') {
      if (specifier === 'typeorm' || specifier.startsWith('@nestjs/')) {
        violations.push(
          createViolation(
            specifier === 'typeorm' ? 'domain-no-typeorm' : 'domain-no-nest',
            filePath,
            `imports ${specifier}`,
          ),
        );
      }
      if (resolved && getLayer(resolved) === 'infrastructure') {
        violations.push(
          createViolation(
            'domain-no-infrastructure',
            filePath,
            `imports ${toRepoRelative(resolved)}`,
          ),
        );
      }
    }

    if (!resolved) {
      continue;
    }

    const targetDomain = getDomainName(resolved);
    if (!targetDomain || targetDomain === currentDomain) {
      continue;
    }

    domainGraph.get(currentDomain).add(targetDomain);

    const targetRepoRelative = toRepoRelative(resolved);
    if (
      targetRepoRelative.includes('/infrastructure/persistence/typeorm/entities/') &&
      targetRepoRelative.endsWith('.entity.ts')
    ) {
      violations.push(
        createViolation(
          'cross-domain-typeorm-entity',
          filePath,
          `imports ${targetRepoRelative}`,
        ),
      );
    }

    if (specifier.startsWith('.') && !isPublicApiTarget(resolved)) {
      violations.push(
        createViolation(
          'cross-domain-deep-import',
          filePath,
          `imports ${targetRepoRelative}`,
        ),
      );
    }
  }
}

for (const cycle of detectCycles(domainGraph)) {
  violations.push(createCycleViolation(cycle));
}

const sortedViolations = sortViolations(violations);

if (updateBaseline) {
  saveBaseline(sortedViolations);
  console.log(`architecture-check: baseline updated (${sortedViolations.length} violations)`);
  process.exit(0);
}

const baselineViolations = sortViolations(loadBaseline());
const baselineKeys = new Set(baselineViolations.map(violationKey));
const currentKeys = new Set(sortedViolations.map(violationKey));

const regressions = sortedViolations.filter((entry) => !baselineKeys.has(violationKey(entry)));
const fixed = baselineViolations.filter((entry) => !currentKeys.has(violationKey(entry)));

if (regressions.length > 0) {
  console.error('architecture-check: regression detected');
  for (const entry of regressions) {
    console.error(`- [${entry.rule}] ${entry.file} :: ${entry.detail}`);
  }
  process.exit(2);
}

console.log(`architecture-check: OK (${sortedViolations.length} baseline violations, no regression)`);
if (fixed.length > 0) {
  console.log(`architecture-check: ${fixed.length} baseline violation(s) disappeared; run --update-baseline to refresh`);
}
