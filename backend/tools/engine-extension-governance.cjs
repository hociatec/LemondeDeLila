#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EXTENSIONS = path.join(ROOT, 'src/game/engine/runtime/extensions');
const GAMES = path.join(ROOT, 'src/game/games');
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
      : entry.name === name
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
  const file = path.join(EXTENSIONS, name, 'program.ts');
  const source = fs.readFileSync(file, 'utf8');
  if (!source.startsWith('/** Single-consumer JSON authoring extension;'))
    throw new Error(`Missing exceptional-profile marker in ${name}`);
  if (
    /\bexport\s+(?:const|let|var|function|class|enum|namespace)\b/.test(source)
  )
    throw new Error(`Executable logic is forbidden in ${name}/program.ts`);
  const count = source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0);
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
  report.push({
    name,
    ...profile,
    consumers: consumers.map(({ file: value }) => path.relative(GAMES, value)),
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

const document = fs.readFileSync(
  path.join(ROOT, 'src/game/engine/runtime/definitions/json-game-document.ts'),
  'utf8',
);
if ((document.match(/extensions\/.*\/program/g) ?? []).length !== 0)
  throw new Error(
    'The generic JSON document must depend only on the extension contract catalog',
  );
const compiler = fs.readFileSync(
  path.join(
    ROOT,
    'src/game/engine/runtime/definitions/json-game-program-compiler.ts',
  ),
  'utf8',
);
if (compiler.split(/\r?\n/).filter(Boolean).length > 4)
  throw new Error('The generic program compiler must remain a registry facade');

console.log(
  JSON.stringify(
    {
      programFiles: programFiles.length,
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
