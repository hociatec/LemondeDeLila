'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const baselineFile = path.join(root, 'tools/sdk-contract-reference.json');
const normalize = value => value.replaceAll('\\', '/');

/** Follow declarations, including nested import types, rather than runtime imports. */
function declarationImports(source) {
  const imports = new Set();
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.add(node.moduleSpecifier.text);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)) imports.add(node.argument.literal.text);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      imports.add(node.moduleReference.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return [...imports].sort();
}

function captureContract({ directory, entry, options }) {
  const compilerOptions = {
    ...options, noEmit: false, declaration: true, emitDeclarationOnly: true,
    declarationMap: false, incremental: false, composite: false, sourceMap: false,
    removeComments: true, newLine: ts.NewLineKind.LineFeed,
    outDir: path.join(directory, '.sdk-contract-memory'),
  };
  const program = ts.createProgram([entry], compilerOptions);
  const declarations = new Map();
  const result = program.emit(undefined, (_file, body, _bom, _error, sources) => {
    if (!_file.endsWith('.d.ts')) return;
    for (const source of sources || []) declarations.set(path.resolve(source.fileName), body);
  });
  const diagnostics = [...program.getOptionsDiagnostics(), ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(), ...result.diagnostics];
  if (result.emitSkipped || diagnostics.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: name => name, getCurrentDirectory: () => directory,
      getNewLine: () => '\n',
    }) || 'Declaration emission was skipped');
  }
  const queue = [path.resolve(entry)];
  const reached = new Map();
  const external = new Set();
  while (queue.length) {
    const file = queue.shift();
    if (reached.has(file)) continue;
    const source = program.getSourceFile(file);
    const body = declarations.get(file) ?? (source?.isDeclarationFile ? source.text : undefined);
    if (body === undefined) throw new Error(`Missing declaration: ${file}`);
    reached.set(file, body);
    const tree = ts.createSourceFile(file + '.d.ts', body, ts.ScriptTarget.Latest, true);
    for (const specifier of declarationImports(tree)) {
      const resolved = ts.resolveModuleName(specifier, file, compilerOptions, ts.sys).resolvedModule;
      if (!resolved) throw new Error(`Unresolved declaration dependency: ${specifier} from ${file}`);
      if (resolved.isExternalLibraryImport || normalize(resolved.resolvedFileName).includes('/node_modules/')) {
        external.add(resolved.packageId
          ? `${resolved.packageId.name}@${resolved.packageId.version}` : specifier);
      } else queue.push(path.resolve(resolved.resolvedFileName));
    }
  }
  const files = [...reached].map(([file, body]) => {
    const relative = normalize(path.relative(directory, file));
    if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error(`Declaration outside workspace: ${file}`);
    return { file: relative, body: body.replaceAll('\r\n', '\n') };
  }).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  return {
    snapshot: {
      schemaVersion: 1, apiVersion: '6.17.0', typescript: ts.version,
      entry: normalize(path.relative(directory, entry)),
      external: [...external].sort(),
      files: files.map(({ file, body }) => ({ file,
        sha256: crypto.createHash('sha256').update(body).digest('hex') })),
    },
    declarations: files,
  };
}

function compareContracts(expected, actual) {
  const changes = [];
  for (const key of ['schemaVersion', 'apiVersion', 'typescript', 'entry', 'external']) {
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key])) changes.push(key);
  }
  const before = new Map(expected.files.map(file => [file.file, file.sha256]));
  const after = new Map(actual.files.map(file => [file.file, file.sha256]));
  for (const file of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    if (before.get(file) !== after.get(file)) changes.push(file);
  }
  return changes;
}

function main() {
  const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
  const contract = captureContract({ directory: root,
    entry: path.join(root, 'src/game/engine/sdk/public-api.ts'), options: config.options });
  if (process.argv.includes('--print')) {
    for (const { file, body } of contract.declarations) process.stdout.write(`// ${file}\n${body}\n`);
    return;
  }
  if (process.argv.includes('--write')) {
    fs.writeFileSync(baselineFile, JSON.stringify(contract.snapshot, null, 2) + '\n');
    console.log(`SDK reference written: ${contract.snapshot.files.length} declaration files`);
    return;
  }
  const expected = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const changes = compareContracts(expected, contract.snapshot);
  if (changes.length) throw new Error(`SDK declaration contract changed:\n${changes.join('\n')}\nReview the API change and its version/migration before updating the reference.`);
  console.log(`SDK contract unchanged: ${contract.snapshot.files.length} declaration files`);
}

module.exports = { captureContract, compareContracts, declarationImports };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
