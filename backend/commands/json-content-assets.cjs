'use strict';
const fs = require('node:fs');
const path = require('node:path');

const MAX_GAME_JSON_LINES = 300;

/** Filesystem access belongs to registry generation, never to a game runtime. */
function jsonContentAssets(gameDirectory) {
  const gameFile = path.join(gameDirectory, 'game.json');
  if (fs.existsSync(gameFile)) {
    const lines = fs.readFileSync(gameFile, 'utf8').split(/\r?\n/).length;
    if (lines > MAX_GAME_JSON_LINES)
      throw new Error(
        `game.json exceeds ${MAX_GAME_JSON_LINES} lines; move content to dedicated JSON assets`,
      );
  }
  const directory = path.join(gameDirectory, 'content');
  const legacyCatalogue = path.join(gameDirectory, 'catalogue.json');
  const legacyQuiz = path.join(gameDirectory, 'quiz.json');
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
  if (fs.existsSync(directory)) {
    if (fs.lstatSync(directory).isSymbolicLink())
      throw new Error('JSON content directory links are forbidden');
    visit(directory);
  }
  for (const [file, relative] of [
    [legacyCatalogue, 'content/catalogue.json'],
    [legacyQuiz, 'content/quiz.json'],
  ]) {
    if (!fs.existsSync(file)) continue;
    if (fs.lstatSync(file).isSymbolicLink())
      throw new Error(`JSON content links are forbidden: ${file}`);
    if (assets.some(asset => asset.relative === relative))
      throw new Error(`Duplicate JSON content path: ${relative}`);
    if (assets.length >= 256)
      throw new Error('JSON content bundle is too large');
    bytes += fs.statSync(file).size;
    if (bytes > 8 * 1024 * 1024)
      throw new Error('JSON content bundle is too large');
    JSON.parse(fs.readFileSync(file, 'utf8'));
    assets.push({ file, relative });
  }
  return assets.sort((a, b) =>
    a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0,
  );
}

module.exports = { jsonContentAssets };
