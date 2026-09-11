const ts = require('typescript');

/** Resolve exported symbols, not every dependency of the module exporting them. */
function createExportOriginReader(files, resolveImport) {
  const options = { noLib: true, types: [], allowJs: true };
  const host = ts.createCompilerHost(options);
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    const resolvedFileName = resolveImport(containingFile, name);
    return resolvedFileName ? { resolvedFileName } : undefined;
  });
  const program = ts.createProgram(files, options, host);
  const checker = program.getTypeChecker();
  return (file) => {
    const source = program.getSourceFile(file);
    const module = source && checker.getSymbolAtLocation(source);
    if (!module) return [];
    const origins = new Set();
    const visited = new Set();
    function collect(exported) {
      const symbol = exported.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exported) : exported;
      if (visited.has(symbol)) return;
      visited.add(symbol);
      for (const declaration of symbol.declarations ?? []) {
        origins.add(declaration.getSourceFile().fileName);
      }
      if (symbol.flags & ts.SymbolFlags.Module) {
        for (const nested of checker.getExportsOfModule(symbol)) collect(nested);
      }
    }
    for (const exported of checker.getExportsOfModule(module)) collect(exported);
    return [...origins];
  };
}

module.exports = { createExportOriginReader };
