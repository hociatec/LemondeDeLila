#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATED_FILES = [
  'game.ts',
  'state.ts',
  'rules.ts',
  'content.ts',
  'game.spec.ts',
];

function kebabToPascal(value) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function quote(value) {
  return JSON.stringify(String(value));
}

function parseArguments(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const [rawKey, inlineValue] = argument.slice(2).split('=', 2);
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue == null) index += 1;
    options[rawKey] = value;
  }
  return { code: positional[0], options };
}

function validateConfiguration(configuration) {
  const { code, world, minPlayers, maxPlayers } = configuration;
  if (!KEBAB_RE.test(code)) throw new Error(`Code invalide: ${quote(code)}`);
  if (!KEBAB_RE.test(world)) throw new Error(`Monde invalide: ${quote(world)}`);
  if (
    !Number.isInteger(minPlayers) ||
    !Number.isInteger(maxPlayers) ||
    minPlayers < 1 ||
    maxPlayers < minPlayers
  ) {
    throw new Error('Limites de joueurs invalides.');
  }
}

function templates(configuration) {
  const { code, name, category, world, minPlayers, maxPlayers } = configuration;
  const typeName = kebabToPascal(code);
  return {
    'state.ts': `export interface ${typeName}State {
  scoresByPlayerId: Record<number, number>;
}
`,
    'content.ts': `export const ${typeName}Content = {
  summary: ${quote(`Règles de ${name} à compléter.`)},
} as const;
`,
    'rules.ts': `import { defineAction, gameInput } from '../../../core/application/public-api';
import type { ${typeName}State } from './state';

export const pass = defineAction<${typeName}State, Record<string, never>>({
  input: gameInput.object({}),
  execute: ({ ctx }) => ctx.turn.end(),
  documentation: 'Termine le tour courant.',
});
`,
    'game.ts': `import { clockwise, defineGame } from '../../../core/application/public-api';
import { ${typeName}Content } from './content';
import { pass } from './rules';

export default defineGame({
  id: ${quote(code)},
  displayName: ${quote(name)},
  category: ${quote(category)},
  subcategory: ${quote(world)},
  description: ${typeName}Content.summary,
  players: { min: ${minPlayers}, max: ${maxPlayers} },
  setup: ({ players }) => ({
    scoresByPlayerId: Object.fromEntries(players.map((player) => [player.id, 0])),
  }),
  turn: clockwise(),
  actions: { pass },
  view: ({ state }) => structuredClone(state),
});
`,
    'game.spec.ts': `import { testGame } from '../../../core/application/public-api';
import gameDefinition from './game';

describe(${quote(name)}, () => {
  it('satisfait le contrat moteur minimal', async () => {
    const game = testGame(gameDefinition).players(${minPlayers}).seed(42);
    await game.start();

    game.as(1).expectAction('pass');
    await game.as(1).do('pass', {});

    expect(game.replay()).toEqual(game.state());
  });
});
`,
  };
}

async function createGame(configuration) {
  validateConfiguration(configuration);
  const gameDirectory = path.join(
    configuration.gamesRoot,
    configuration.world,
    configuration.code,
  );
  if (fs.existsSync(gameDirectory)) {
    throw new Error(`Le dossier existe déjà: ${gameDirectory}`);
  }
  await fsp.mkdir(gameDirectory, { recursive: true });
  const contentByFile = templates(configuration);
  for (const file of GENERATED_FILES) {
    await fsp.writeFile(
      path.join(gameDirectory, file),
      contentByFile[file],
      'utf8',
    );
  }
  return gameDirectory;
}

async function resolveConfiguration(argv) {
  const parsed = parseArguments(argv);
  const defaults = {
    gamesRoot: path.resolve(process.cwd(), 'src', 'game', 'games'),
    world: parsed.options.world,
    code: parsed.code,
    name: parsed.options.name,
    category: parsed.options.category ?? 'JeuxDePlateaux',
    minPlayers: Number(parsed.options.min ?? 2),
    maxPlayers: Number(parsed.options.max ?? 4),
  };
  if (parsed.options['games-root']) {
    defaults.gamesRoot = path.resolve(parsed.options['games-root']);
  }
  if (defaults.code && defaults.world) {
    defaults.name ||= kebabToPascal(defaults.code);
    return defaults;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      'Usage: npm run create:game -- <code> --world <monde> [options]',
    );
  }
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    defaults.code = (
      defaults.code ?? (await prompt.question('Code du jeu (kebab-case): '))
    )
      .trim()
      .toLowerCase();
    defaults.world = (
      defaults.world ?? (await prompt.question('Monde (kebab-case): '))
    )
      .trim()
      .toLowerCase();
    defaults.name =
      (
        await prompt.question(`Nom affiché (${kebabToPascal(defaults.code)}): `)
      ).trim() || kebabToPascal(defaults.code);
    return defaults;
  } finally {
    prompt.close();
  }
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(
      'Usage: npm run create:game -- <code> --world <monde> [--name <nom>] [--min 2] [--max 4]',
    );
    return;
  }
  const configuration = await resolveConfiguration(process.argv.slice(2));
  const directory = await createGame(configuration);
  console.log(`Jeu créé: ${directory}`);
  console.log(`Fichiers: ${GENERATED_FILES.join(', ')}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { GENERATED_FILES, createGame, parseArguments, templates };
