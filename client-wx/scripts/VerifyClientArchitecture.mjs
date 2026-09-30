import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('../src/', import.meta.url);
const violations = [];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.cpp', '.h'].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

function reject(path, source, pattern, message) {
  if (pattern.test(source)) violations.push(`${relative(root.pathname, path)}: ${message}`);
}

for (const path of await sourceFiles(root.pathname)) {
  const source = await readFile(path, 'utf8');
  const name = relative(root.pathname, path).replaceAll('\\', '/');

  if (name.startsWith('modules/admin/domain/')) {
    reject(path, source, /nlohmann(?:\/json|::json)/, 'le domaine Admin ne doit pas dépendre de JSON');
  }
  if (name.startsWith('modules/admin/application/')) {
    reject(path, source, /nlohmann(?:\/json|::json)/, "l'application Admin ne doit pas exposer JSON");
  }
  if (/\/(?:domain|application)\//.test(`/${name}`)) {
    reject(path, source, /#include\s*[<"](?:windows\.h|winhttp\.h)[>"]/, 'WinHTTP appartient à infrastructure');
    reject(path, source, /#include\s*[<"]wx\//, 'wxWidgets appartient à présentation');
  }
  if (name.includes('GamePlayPanel')) {
    reject(
      path,
      source,
      /\b(?:roomStarted_|awaitingStartedState_|roomStartPending_|roomStartFlowRequested_|observedEventIdentities_)\b/,
      'ancien état booléen ou stockage de déduplication non borné',
    );
  }
  reject(path, source, /\bReconnectDelay\s*\(/, 'utiliser la politique ReconnectPolicy partagée');
}

if (violations.length > 0) {
  console.error(`Frontières client invalides:\n${violations.join('\n')}`);
  process.exit(1);
}

console.log('Architecture client vérifiée.');
