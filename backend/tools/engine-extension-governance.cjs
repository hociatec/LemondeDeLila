#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EXTENSIONS = path.join(ROOT, 'src/game/engine/runtime/extensions');
const GAMES = path.join(ROOT, 'src/game/games');
const GAMEPLAY = path.join(ROOT, 'src/game/engine/runtime/recipes/gameplay');
const policy = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'engine-extension-governance.json'),
    'utf8',
  ),
);

function files(directory, name) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(absolute, name)
      : !name || entry.name === name
        ? [absolute]
        : [];
  });
}

const programFiles = files(EXTENSIONS, 'program.ts');
const discovered = programFiles
  .map((file) => path.basename(path.dirname(file)))
  .sort();
const declared = Object.keys(policy.profiles).sort();
if (JSON.stringify(discovered) !== JSON.stringify(declared))
  throw new Error('Every program profile must be explicitly classified');

const gameDocuments = files(GAMES, 'game.json').map((file) => ({
  file,
  source: JSON.parse(fs.readFileSync(file, 'utf8')),
}));
let lines = 0;
let reusableLines = 0;
const report = [];
for (const name of declared) {
  const profile = policy.profiles[name];
  if (
    !profile.mechanic ||
    !['reusable', 'game-specific'].includes(profile.classification)
  )
    throw new Error(`Incomplete classification for ${name}`);

  const programFile = path.join(EXTENSIONS, name, 'program.ts');
  const program = fs.readFileSync(programFile, 'utf8');
  const marker =
    profile.classification === 'reusable'
      ? '/** Reusable JSON authoring extension;'
      : '/** Single-consumer JSON authoring extension;';
  if (!program.startsWith(marker))
    throw new Error(`Incorrect classification marker in ${name}/program.ts`);
  if (
    /\bexport\s+(?:const|let|var|function|class|enum|namespace)\b/.test(program)
  )
    throw new Error(`Executable logic is forbidden in ${name}/program.ts`);

  const count =
    program.split(/\r?\n/).length - (program.endsWith('\n') ? 1 : 0);
  lines += count;
  if (profile.classification === 'reusable') reusableLines += count;

  const consumers = profile.property
    ? gameDocuments.filter(({ source: document }) =>
        Object.hasOwn(document, profile.property),
      )
    : [];
  if (profile.property && consumers.length !== 1)
    throw new Error(
      `${name} must have its actual consumer count reviewed (found ${consumers.length})`,
    );

  if (profile.property) {
    const extensionFile = path.join(EXTENSIONS, name, 'extension.ts');
    if (!fs.existsSync(extensionFile))
      throw new Error(`${name}/extension.ts is required`);
    const extension = fs.readFileSync(extensionFile, 'utf8');
    for (const contribution of [
      'defineJsonProgramExtension',
      'documentKey:',
      'schema:',
      'compile:',
      'handlers:',
      'actions:',
      'validate:',
    ])
      if (!extension.includes(contribution))
        throw new Error(`${name}/extension.ts does not own ${contribution}`);
    if (!extension.includes(`documentKey: '${profile.property}'`))
      throw new Error(`${name}/extension.ts has the wrong document key`);
  }

  report.push({
    name,
    ...profile,
    consumers: consumers.map(({ file }) => path.relative(GAMES, file)),
  });
}

if (programFiles.length > policy.maximumProgramFiles)
  throw new Error(
    `Program profile count grew: ${programFiles.length} > ${policy.maximumProgramFiles}`,
  );
if (lines > policy.maximumProgramLines)
  throw new Error(
    `Program profile lines grew: ${lines} > ${policy.maximumProgramLines}`,
  );

const registryFile = path.join(
  EXTENSIONS,
  'json-program-extension-registry.ts',
);
const registry = fs.readFileSync(registryFile, 'utf8');
const registered = [...registry.matchAll(/^  \w+Extension,?$/gm)].length;
if (
  !registry.includes('Object.freeze([') ||
  !registry.includes('No filesystem discovery')
)
  throw new Error(
    'The extension registry must be static, frozen and deterministic',
  );
if (registered > policy.maximumRegisteredExtensions)
  throw new Error(
    `Registered extension count grew: ${registered} > ${policy.maximumRegisteredExtensions}`,
  );

const centralFiles = [
  'json-program-extension-contract.ts',
  'json-program-extension-schemas.ts',
  'json-program-extension-compilers.ts',
  '../definitions/json-game-program-handlers.ts',
  '../definitions/json-game-action-compiler.ts',
  '../definitions/json-program-reference-validation.ts',
  '../definitions/json-program-initialization.ts',
];
const gameSpecificProperties = Object.values(policy.profiles)
  .filter(
    ({ classification, property }) =>
      classification === 'game-specific' && property,
  )
  .map(({ property }) => property);
for (const relative of centralFiles) {
  const source = fs.readFileSync(path.resolve(EXTENSIONS, relative), 'utf8');
  for (const property of gameSpecificProperties)
    if (new RegExp(`\\b${property}\\b`).test(source))
      throw new Error(
        `${relative} knows the game-specific profile ${property}`,
      );
}

const gameplayFiles = files(GAMEPLAY)
  .map((file) => path.basename(file))
  .sort();
const allowedGameplayFiles = [...policy.genericGameplayFiles].sort();
if (JSON.stringify(gameplayFiles) !== JSON.stringify(allowedGameplayFiles))
  throw new Error(
    'runtime/recipes/gameplay must contain only reviewed generic primitives',
  );

const document = fs.readFileSync(
  path.join(ROOT, 'src/game/engine/runtime/definitions/json-game-document.ts'),
  'utf8',
);
if ((document.match(/extensions\/.*\/program/g) ?? []).length !== 0)
  throw new Error(
    'The generic JSON document must depend only on the extension contract catalog',
  );

console.log(
  JSON.stringify(
    {
      programFiles: programFiles.length,
      registeredExtensions: registered,
      genericGameplayFiles: gameplayFiles.length,
      programLines: lines,
      reusableLines,
      reusableRatio: Number((reusableLines / lines).toFixed(3)),
      singleConsumerProfiles: report.filter(
        (item) => item.consumers.length === 1,
      ).length,
    },
    null,
    2,
  ),
);
