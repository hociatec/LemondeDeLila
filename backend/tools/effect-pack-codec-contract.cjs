'use strict';
const path = require('node:path');
const ts = require('typescript');
const { schemaType } = require('./author-schema-types.cjs');
const root = path.resolve(__dirname, '..');

function checkCodecContracts() {
  require('ts-node').register({
    transpileOnly: true,
    project: path.join(root, 'tsconfig.json'),
  });
  const { effectJsonDefinitions } = require(
    path.join(root, 'src/game/engine/runtime/contracts/effect-json-schema'),
  );
  const { jsonEffectPacks } = require(
    path.join(root, 'src/game/rules/effect-packs/json-effect-pack-registry'),
  );
  const references = Object.fromEntries(
    Object.keys(effectJsonDefinitions).map((name, index) => [
      name,
      `Reference${index}`,
    ]),
  );
  const lines = [
    "import { jsonEffectPacks } from './json-effect-pack-registry';",
  ];
  for (const [name, schema] of Object.entries(effectJsonDefinitions))
    lines.push(`type ${references[name]} = ${schemaType(schema, references)};`);
  jsonEffectPacks.forEach((pack, index) => {
    lines.push(`type Input${index} = ${schemaType(pack.schema, references)};`);
    lines.push(
      `export function check_${pack.documentKey}(value: Input${index}): Parameters<(typeof jsonEffectPacks)[${index}]['compile']>[0] { return value; }`,
    );
  });
  const file = path.join(
    root,
    'src/game/rules/effect-packs/__codec-contracts__.ts',
  );
  const source = lines.join('\n');
  const config = ts.readConfigFile(
    path.join(root, 'tsconfig.json'),
    ts.sys.readFile,
  );
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, '\n'),
    );
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const options = {
    ...parsed.options,
    noEmit: true,
    incremental: false,
    noUnusedLocals: false,
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    name,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) =>
    path.resolve(name) === file
      ? ts.createSourceFile(name, source, languageVersion, true)
      : getSourceFile(
          name,
          languageVersion,
          onError,
          shouldCreateNewSourceFile,
        );
  const program = ts.createProgram([file], options, host);
  const errors = ts.getPreEmitDiagnostics(program);
  if (errors.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(errors, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (name) => name,
        getNewLine: () => '\n',
      }),
    );
  return jsonEffectPacks.length;
}
module.exports = { checkCodecContracts };
if (require.main === module) {
  try {
    console.log(
      `Codec contracts: ${checkCodecContracts()} schemas statically assignable to their program inputs`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
