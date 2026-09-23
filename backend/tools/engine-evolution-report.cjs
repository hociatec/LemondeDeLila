'use strict';
const fs = require('node:fs');
const path = require('node:path');

function compareEvolution(current, previous) {
  const added = (key) =>
    current[key].filter((id) => !previous[key].includes(id));
  const games = added('games'),
    effectPacks = added('effectPacks'),
    primitives = added('primitives');
  return {
    games,
    effectPacks,
    primitives,
    counts: {
      newGames: games.length,
      newEffectPacks: effectPacks.length,
      newPrimitives: primitives.length,
      gamesPerNewEffectPack: effectPacks.length
        ? games.length / effectPacks.length
        : null,
      gamesPerNewPrimitive: primitives.length
        ? games.length / primitives.length
        : null,
    },
    requiresReview: effectPacks.length > 0 || primitives.length > 0,
  };
}

function captureEvolution(root = path.resolve(__dirname, '..')) {
  require('ts-node').register({
    transpileOnly: true,
    project: path.join(root, 'tsconfig.json'),
  });
  const { effectJsonDefinitions } = require(
    path.join(root, 'src/game/engine/runtime/contracts/effect-json-schema'),
  );
  const { jsonGameSchema } = require(
    path.join(root, 'src/game/engine/runtime/definitions/json-game-schema'),
  );
  const walk = (directory) =>
    fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      );
  const files = walk(path.join(root, 'src/game/games'));
  const documents = files.filter((file) => path.basename(file) === 'game.json');
  const policy = JSON.parse(
    fs.readFileSync(
      path.join(root, 'tools/engine-effect-pack-governance.json'),
      'utf8',
    ),
  );
  const primitives = Object.entries(effectJsonDefinitions).flatMap(
    ([kind, schema]) =>
      (schema.oneOf ?? [])
        .filter((item) => typeof item.properties?.kind?.const === 'string')
        .map((item) => `${kind}:${item.properties.kind.const}`),
  );
  primitives.push(
    ...jsonGameSchema.properties.components.items.oneOf.map(
      (item) => `component:${item.properties.component.const}`,
    ),
  );
  const games = files
    .filter((file) => path.basename(file) === 'manifest.json')
    .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')).code)
    .sort();
  return {
    games,
    effectPacks: Object.keys(policy.profiles).sort(),
    primitives: [...new Set(primitives)].sort(),
    declarativity: {
      jsonGames: documents.length,
      totalGames: games.length,
      definition:
        'Production game.json documents; not a measure of reusable implementation.',
    },
    reuse: Object.fromEntries(
      ['game-specific', 'reusable', 'engine-primitive'].map((scope) => [
        scope,
        Object.values(policy.profiles).filter(
          (profile) => profile.scope === scope,
        ).length,
      ]),
    ),
  };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const current = captureEvolution(root);
  const index = process.argv.indexOf('--compare');
  const file =
    index < 0
      ? path.join(root, 'tools/engine-evolution-reference.json')
      : path.resolve(process.argv[index + 1]);
  const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(
    JSON.stringify(
      { ...current, evolution: compareEvolution(current, previous) },
      null,
      2,
    ),
  );
}
module.exports = { compareEvolution, captureEvolution };
