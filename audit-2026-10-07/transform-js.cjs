const ts = require('../backend/node_modules/typescript');
module.exports = { process(source, fileName) {
  return { code: ts.transpileModule(source, { fileName, compilerOptions: {
    allowJs: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText };
} };
