'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** Filesystem access belongs to registry generation, never to a game runtime. */
function jsonContentAssets(gameDirectory) {
  const directory = path.join(gameDirectory, 'content');
  const legacyQuiz = path.join(gameDirectory, 'quiz.json');
  if (!fs.existsSync(directory))
    return fs.existsSync(legacyQuiz)
      ? [{ file: legacyQuiz, relative: 'content/quiz.json' }]
      : [];
  const root = fs.realpathSync(gameDirectory);
  const assets = [];
  let bytes = 0;
  function visit(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`JSON content links are forbidden: ${file}`);
      const real = fs.realpathSync(file);
      const relative = path.relative(root, real).replaceAll(path.sep, '/');
      if (relative.startsWith('../') || path.isAbsolute(relative))
        throw new Error('JSON content escapes its game');
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.json')) {
        if (
          !/^content\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/.test(relative)
        )
          throw new Error(`Invalid JSON content path: ${relative}`);
        bytes += fs.statSync(file).size;
        if (assets.length >= 256 || bytes > 8 * 1024 * 1024)
          throw new Error('JSON content bundle is too large');
        JSON.parse(fs.readFileSync(file, 'utf8'));
        assets.push({ file, relative });
      }
    }
  }
  if (fs.lstatSync(directory).isSymbolicLink())
    throw new Error('JSON content directory links are forbidden');
  visit(directory);
  if (fs.existsSync(legacyQuiz)) {
    bytes += fs.statSync(legacyQuiz).size;
    if (bytes > 8 * 1024 * 1024)
      throw new Error('JSON content bundle is too large');
    JSON.parse(fs.readFileSync(legacyQuiz, 'utf8'));
    assets.push({ file: legacyQuiz, relative: 'content/quiz.json' });
  }
  return assets.sort((a, b) =>
    a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0,
  );
}

module.exports = { jsonContentAssets };
