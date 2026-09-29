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
  const references = Object.fromEntries(
    Object.keys(effectJsonDefinitions).map((name, index) => [
      name,
      `Reference${index}`,
    ]),
  );
  const lines = [];
  for (const [name, schema] of Object.entries(effectJsonDefinitions))
    lines.push(`type ${references[name]} = ${schemaType(schema, references)};`);
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
  return Object.keys(effectJsonDefinitions).length;
}
module.exports = { checkCodecContracts };
if (require.main === module) {
  try {
    console.log(
      `Codec contracts: ${checkCodecContracts()} generic effect schemas compile to static types`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
