#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(repoRoot, 'src');
const contractFile = path.join(__dirname, 'architecture-contract.json');
const baselineFile = path.join(__dirname, 'architecture-baseline.json');

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORED_SUFFIXES = ['.spec.ts', '.test.ts', '.e2e-spec.ts', '.d.ts'];

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadContract(filePath = contractFile) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Contrat d'architecture introuvable: ${filePath}`);
  }
  return readJson(filePath);
}

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
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (isSourceFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function toRepoRelative(filePath, root = repoRoot) {
  return normalizeSlashes(path.relative(root, filePath));
}

function toSrcRelative(filePath, root = srcRoot) {
  return normalizeSlashes(path.relative(root, filePath));
}

function describeComponent(srcRelative, contract) {
  const parts = normalizeSlashes(srcRelative).split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1 && path.extname(parts[0])) {
    return { name: 'root', root: '', depth: 0, kind: 'composition' };
  }

  const gameFamilies = new Set(contract.components?.gameFamilies ?? []);
  if (
    parts[0] === 'game' &&
    parts[1] === 'games' &&
    gameFamilies.has(parts[2]) &&
    parts[3]
  ) {
    return {
      name: `game.games.${parts[2]}.${parts[3]}`,
      root: parts.slice(0, 4).join('/'),
      depth: 4,
      kind: 'game',
    };
  }

  if (parts[0] === 'game' && parts[1] === 'engine') {
    return {
      name: 'game.engine',
      root: 'game/engine',
      depth: 2,
      kind: 'engine',
    };
  }

  const modules = new Set(contract.components?.modules ?? []);
  if (parts[0] === 'modules' && modules.has(parts[1])) {
    return {
      name: parts[1],
      root: `modules/${parts[1]}`,
      depth: 2,
      kind: 'domain',
    };
  }

  const platform = new Set(contract.components?.platform ?? []);
  if (parts[0] === 'platform' && platform.has(parts[1])) {
    return {
      name: `platform.${parts[1]}`,
      root: `platform/${parts[1]}`,
      depth: 2,
      kind: 'platform',
    };
  }

  const shared = new Set(contract.components?.shared ?? []);
  if (parts[0] === 'shared' && shared.has(parts[1])) {
    return {
      name: `shared.${parts[1]}`,
      root: `shared/${parts[1]}`,
      depth: 2,
      kind: 'shared',
    };
  }

  return { name: parts[0], root: parts[0], depth: 1, kind: 'domain' };
}

function detectLayer(srcRelative, component, contract) {
  if (!component) return null;
  const parts = normalizeSlashes(srcRelative).split('/').filter(Boolean);
  const segmentToLayer = new Map();
  for (const [layer, segments] of Object.entries(contract.layers ?? {})) {
    for (const segment of segments) segmentToLayer.set(segment, layer);
  }
  for (const segment of parts.slice(component.depth)) {
    const layer = segmentToLayer.get(segment);
    if (layer) return layer;
  }
  return null;
}

function describeFile(filePath, contract, root = srcRoot) {
  const relative = toSrcRelative(filePath, root);
  const component = describeComponent(relative, contract);
  return {
    filePath,
    relative,
    component,
    layer: detectLayer(relative, component, contract),
  };
}

function resolveImport(fromFile, specifier, contract, root = srcRoot) {
  let basePath = null;
  if (specifier.startsWith('.')) {
    basePath = path.resolve(path.dirname(fromFile), specifier);
  } else {
    for (const [alias, target] of Object.entries(contract.aliases ?? {})) {
      if (specifier === alias || specifier.startsWith(`${alias}/`)) {
        const suffix =
          specifier === alias ? '' : specifier.slice(alias.length + 1);
        basePath = path.join(root, target, suffix);
        break;
      }
    }
  }
  if (!basePath) return null;

  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((ext) => `${basePath}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(basePath, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      return candidate;
  }
  return null;
}

function getImports(filePath, contract, root = srcRoot) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    false,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = [];

  function add(specifier, kind) {
    if (!specifier) return;
    imports.push({
      specifier,
      kind,
      resolved: resolveImport(filePath, specifier, contract, root),
    });
  }

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      add(node.moduleSpecifier.text, 'import');
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      add(node.moduleSpecifier.text, 'export');
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text, 'dynamic-import');
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return imports;
}

function isPublicEntry(fileInfo, contract) {
  return (contract.publicEntryFiles ?? ['public-api.ts', 'index.ts']).includes(
    path.basename(fileInfo.filePath),
  );
}

function isComponentPublicEntry(fileInfo, contract) {
  if (!fileInfo.component || !isPublicEntry(fileInfo, contract)) return false;
  const expected = new Set(
    (contract.publicEntryFiles ?? ['public-api.ts', 'index.ts']).map(
      (name) => `${fileInfo.component.root}/${name}`,
    ),
  );
  return expected.has(fileInfo.relative);
}

function isCompositionSource(fileInfo, contract) {
  if (!fileInfo.component) return true;
  if (fileInfo.component.kind === 'composition') return true;
  if (
    (contract.composition?.rootComponents ?? []).includes(
      fileInfo.component.name,
    )
  )
    return true;
  if ((contract.composition?.rootFiles ?? []).includes(fileInfo.relative))
    return true;
  if ((contract.composition?.layers ?? ['module']).includes(fileInfo.layer))
    return true;
  return (contract.composition?.fileSuffixes ?? ['.module.ts']).some((suffix) =>
    fileInfo.relative.endsWith(suffix),
  );
}

function isBoundaryExemptSource(fileInfo, contract) {
  return (
    (contract.boundaries?.exemptSourceComponents ?? []).includes(
      fileInfo.component?.name,
    ) ||
    (contract.boundaries?.exemptSourceFiles ?? []).includes(fileInfo.relative)
  );
}

function componentPatternMatches(componentName, pattern) {
  if (pattern.endsWith('*'))
    return componentName.startsWith(pattern.slice(0, -1));
  return componentName === pattern;
}

function isAllowedDeepImport(sourceComponent, targetComponent, contract) {
  return (contract.boundaries?.allowedDeepImports ?? []).some(
    (rule) =>
      componentPatternMatches(sourceComponent.name, rule.source) &&
      componentPatternMatches(targetComponent.name, rule.target),
  );
}

function isAllowedDependency(sourceComponent, targetComponent, contract) {
  return (contract.dependencies?.allowed ?? []).some(
    (rule) =>
      componentPatternMatches(sourceComponent.name, rule.source) &&
      componentPatternMatches(targetComponent.name, rule.target),
  );
}

function graphComponentName(component, contract) {
  for (const rule of contract.cycles?.aggregate ?? []) {
    if (componentPatternMatches(component.name, rule.source))
      return rule.target;
  }
  return component.name;
}

function isTypeOrmEntity(fileInfo) {
  return (
    fileInfo.relative.includes(
      '/infrastructure/persistence/typeorm/entities/',
    ) && fileInfo.relative.endsWith('.entity.ts')
  );
}

function makeViolation(rule, sourceInfo, targetInfo, subject, detail) {
  return {
    rule,
    source: sourceInfo.component?.name ?? '(root)',
    target: targetInfo?.component?.name ?? null,
    subject: subject ?? null,
    file: sourceInfo.relative,
    detail,
  };
}

function addGraphEdge(graph, from, to) {
  if (!graph.has(from)) graph.set(from, new Set());
  graph.get(from).add(to);
  if (!graph.has(to)) graph.set(to, new Set());
}

function detectStronglyConnectedComponents(graph) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowLinks = new Map();
  const components = [];

  function connect(node) {
    indices.set(node, index);
    lowLinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of [...(graph.get(node) ?? [])].sort()) {
      if (!indices.has(next)) {
        connect(next);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(next)));
      } else if (onStack.has(next)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(next)));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;
    const members = [];
    let current = null;
    do {
      current = stack.pop();
      onStack.delete(current);
      members.push(current);
    } while (current !== node);
    if (members.length > 1) components.push(members.sort());
  }

  for (const node of [...graph.keys()].sort()) {
    if (!indices.has(node)) connect(node);
  }
  return components.sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

function analyzeArchitecture({
  root = srcRoot,
  contract = loadContract(),
} = {}) {
  const ignoredRootDirectories = new Set(
    contract.ignoredRootDirectories ?? [],
  );
  const files = walk(root).filter((filePath) => {
    const [rootDirectory] = toSrcRelative(filePath, root).split('/');
    return !ignoredRootDirectories.has(rootDirectory);
  });
  const violations = [];
  const graph = new Map();
  const componentNames = new Set();

  for (const filePath of files) {
    const sourceInfo = describeFile(filePath, contract, root);
    if (!sourceInfo.component) continue;
    componentNames.add(sourceInfo.component.name);
    if (!graph.has(sourceInfo.component.name))
      graph.set(sourceInfo.component.name, new Set());

    const relativeParts = sourceInfo.relative.split('/');
    const legacyDir = relativeParts[sourceInfo.component.depth];
    if (
      sourceInfo.component.kind === 'domain' &&
      (contract.legacyRootDirectories ?? []).includes(legacyDir)
    ) {
      violations.push(
        makeViolation(
          'legacy-root-structure',
          sourceInfo,
          null,
          legacyDir,
          `stored under legacy root directory "${legacyDir}"`,
        ),
      );
    }

    for (const entry of getImports(filePath, contract, root)) {
      const { specifier, resolved } = entry;
      const targetInfo = resolved
        ? describeFile(resolved, contract, root)
        : null;

      if (sourceInfo.layer === 'application') {
        if (
          specifier === 'typeorm' ||
          specifier.startsWith('@nestjs/typeorm')
        ) {
          violations.push(
            makeViolation(
              'application-no-typeorm',
              sourceInfo,
              null,
              specifier,
              `imports ${specifier}`,
            ),
          );
        }
        if (targetInfo?.layer === 'infrastructure') {
          violations.push(
            makeViolation(
              'application-no-infrastructure',
              sourceInfo,
              targetInfo,
              null,
              `imports ${targetInfo.relative}`,
            ),
          );
        }
      }

      if (sourceInfo.layer === 'domain') {
        if (specifier === 'typeorm' || specifier.startsWith('@nestjs/')) {
          violations.push(
            makeViolation(
              specifier === 'typeorm' ? 'domain-no-typeorm' : 'domain-no-nest',
              sourceInfo,
              null,
              specifier,
              `imports ${specifier}`,
            ),
          );
        }
        if (targetInfo?.layer === 'infrastructure') {
          violations.push(
            makeViolation(
              'domain-no-infrastructure',
              sourceInfo,
              targetInfo,
              null,
              `imports ${targetInfo.relative}`,
            ),
          );
        }
      }

      if (!targetInfo?.component) continue;
      const sameComponent =
        targetInfo.component.name === sourceInfo.component.name;
      const compositionSource = isCompositionSource(sourceInfo, contract);

      if (
        entry.kind === 'export' &&
        isComponentPublicEntry(sourceInfo, contract) &&
        sameComponent &&
        isTypeOrmEntity(targetInfo)
      ) {
        violations.push(
          makeViolation(
            'public-api-no-typeorm-entity',
            sourceInfo,
            targetInfo,
            'typeorm-entity',
            `exports ${targetInfo.relative}`,
          ),
        );
      }

      if (sameComponent) continue;

      if (
        sourceInfo.component.kind === 'shared' &&
        targetInfo.component.kind !== 'shared'
      ) {
        violations.push(
          makeViolation(
            'shared-dependency-direction',
            sourceInfo,
            targetInfo,
            null,
            `shared cannot depend on ${targetInfo.component.name}`,
          ),
        );
      }
      if (
        sourceInfo.component.kind === 'platform' &&
        ['domain', 'game', 'engine'].includes(targetInfo.component.kind) &&
        !isBoundaryExemptSource(sourceInfo, contract)
      ) {
        violations.push(
          makeViolation(
            'platform-dependency-direction',
            sourceInfo,
            targetInfo,
            null,
            `platform cannot depend on ${targetInfo.component.name}`,
          ),
        );
      }

      if (!compositionSource) {
        const graphSource = graphComponentName(sourceInfo.component, contract);
        const graphTarget = graphComponentName(targetInfo.component, contract);
        if (graphSource !== graphTarget)
          addGraphEdge(graph, graphSource, graphTarget);

        if (!isAllowedDependency(sourceInfo.component, targetInfo.component, contract)) {
          violations.push(
            makeViolation(
              'unapproved-component-dependency',
              sourceInfo,
              targetInfo,
              null,
              `dependency ${sourceInfo.component.name} -> ${targetInfo.component.name} is not declared`,
            ),
          );
        }
      }

      if (
        sourceInfo.component.kind === 'game' &&
        targetInfo.component.kind === 'game'
      ) {
        violations.push(
          makeViolation(
            'cross-game-dependency',
            sourceInfo,
            targetInfo,
            null,
            `imports ${targetInfo.relative}`,
          ),
        );
      }

      if (isBoundaryExemptSource(sourceInfo, contract)) continue;

      if (
        isTypeOrmEntity(targetInfo) &&
        !(
          compositionSource &&
          contract.boundaries?.allowCompositionTypeOrmEntities === true
        )
      ) {
        violations.push(
          makeViolation(
            'cross-component-typeorm-entity',
            sourceInfo,
            targetInfo,
            'typeorm-entity',
            `imports ${targetInfo.relative}`,
          ),
        );
      }

      if (
        !(
          compositionSource &&
          contract.boundaries?.allowCompositionDeepImports === true
        ) &&
        !isComponentPublicEntry(targetInfo, contract) &&
        !isAllowedDeepImport(
          sourceInfo.component,
          targetInfo.component,
          contract,
        )
      ) {
        violations.push(
          makeViolation(
            'cross-component-deep-import',
            sourceInfo,
            targetInfo,
            null,
            `imports ${targetInfo.relative}`,
          ),
        );
      }
    }
  }

  for (const members of detectStronglyConnectedComponents(graph)) {
    const pseudoSource = {
      relative: '(component-graph)',
      component: { name: members.join(' <-> ') },
    };
    violations.push(
      makeViolation(
        'component-cycle',
        pseudoSource,
        null,
        members.join('|'),
        `strongly connected components: ${members.join(', ')}`,
      ),
    );
  }

  return { files, violations, graph, components: componentNames };
}

function groupKey(entry) {
  return [
    entry.rule,
    entry.source,
    entry.target ?? '',
    entry.subject ?? '',
  ].join('::');
}

function groupViolations(violations) {
  const groups = new Map();
  for (const violation of violations) {
    const key = groupKey(violation);
    let group = groups.get(key);
    if (!group) {
      group = {
        rule: violation.rule,
        source: violation.source,
        target: violation.target,
        subject: violation.subject,
        count: 0,
        samples: [],
      };
      groups.set(key, group);
    }
    group.count += 1;
    if (group.samples.length < 5) {
      group.samples.push({ file: violation.file, detail: violation.detail });
    }
  }
  return [...groups.values()].sort((a, b) =>
    groupKey(a).localeCompare(groupKey(b)),
  );
}

function compareGroups(currentGroups, baselineGroups) {
  const baselineByKey = new Map(
    baselineGroups.map((group) => [groupKey(group), group]),
  );
  const currentByKey = new Map(
    currentGroups.map((group) => [groupKey(group), group]),
  );
  const regressions = [];
  const improvements = [];

  for (const current of currentGroups) {
    const previous = baselineByKey.get(groupKey(current));
    const previousCount = previous?.count ?? 0;
    if (current.count > previousCount) {
      regressions.push({ ...current, delta: current.count - previousCount });
    }
  }
  for (const previous of baselineGroups) {
    const currentCount = currentByKey.get(groupKey(previous))?.count ?? 0;
    if (currentCount < previous.count) {
      improvements.push({ ...previous, delta: previous.count - currentCount });
    }
  }
  return { regressions, improvements };
}

function saveBaseline(groups, contract) {
  const payload = {
    schemaVersion: 2,
    contractVersion: contract.version,
    generatedAt: new Date().toISOString(),
    groups,
  };
  fs.writeFileSync(
    baselineFile,
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
}

function loadBaseline() {
  if (!fs.existsSync(baselineFile)) return null;
  return readJson(baselineFile);
}

function formatGroup(group) {
  const edge = group.target
    ? `${group.source} -> ${group.target}`
    : group.source;
  return `[${group.rule}] ${edge} (+${group.delta ?? group.count}, total=${group.count})`;
}

function main(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  const contract = loadContract();
  const analysis = analyzeArchitecture({ contract });
  const groups = groupViolations(analysis.violations);
  const dependencyEdges = [...analysis.graph.values()].reduce(
    (total, targets) => total + targets.size,
    0,
  );

  if (args.has('--update-baseline')) {
    saveBaseline(groups, contract);
    console.log(
      `architecture-check: baseline schema v2 / contract v${contract.version} updated (${groups.length} groups, ${analysis.violations.length} occurrences)`,
    );
    return 0;
  }

  const baseline = loadBaseline();
  if (!baseline || baseline.schemaVersion !== 2) {
    console.error(
      'architecture-check: baseline incompatible; run "npm run architecture:baseline:update" after reviewing the contract',
    );
    return 2;
  }
  if (baseline.contractVersion !== contract.version) {
    console.error(
      `architecture-check: contract v${contract.version} and baseline contract v${baseline.contractVersion} differ`,
    );
    return 2;
  }

  const { regressions, improvements } = compareGroups(
    groups,
    baseline.groups ?? [],
  );
  console.log(
    `architecture-check: ${analysis.files.length} files, ${analysis.components.size} components, ${dependencyEdges} dependency edges`,
  );

  if (regressions.length > 0) {
    console.error('architecture-check: regression detected');
    for (const group of regressions) {
      console.error(`- ${formatGroup(group)}`);
      for (const sample of group.samples.slice(0, 3)) {
        console.error(`  ${sample.file} :: ${sample.detail}`);
      }
    }
    return 2;
  }

  console.log(
    `architecture-check: OK (${groups.length} baseline groups, ${analysis.violations.length} occurrences, no regression)`,
  );
  if (improvements.length > 0) {
    const count = improvements.reduce((total, group) => total + group.delta, 0);
    console.log(
      `architecture-check: ${count} occurrence(s) disappeared; refresh the baseline after review`,
    );
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(
      `architecture-check: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  }
}

module.exports = {
  analyzeArchitecture,
  compareGroups,
  describeComponent,
  describeFile,
  detectLayer,
  detectStronglyConnectedComponents,
  groupViolations,
  isComponentPublicEntry,
  isAllowedDependency,
  isCompositionSource,
  loadContract,
  main,
};
