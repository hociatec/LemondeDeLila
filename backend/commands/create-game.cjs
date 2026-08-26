#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATED_FILES = [
  'game.ts',
  'rules.ts',
  'content.ts',
  'game.spec.ts',
];
const GAME_TEMPLATES = ['empty', 'card', 'race', 'quiz', 'party', 'board'];

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
  const { code, world, minPlayers, maxPlayers, template = 'empty' } = configuration;
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
  if (!GAME_TEMPLATES.includes(template)) {
    throw new Error(`Template inconnu: ${quote(template)}`);
  }
}

function templates(configuration) {
  const {
    code,
    name,
    category,
    world,
    minPlayers,
    maxPlayers,
    template = 'empty',
  } = configuration;
  const typeName = kebabToPascal(code);
  const family = familyTemplate(template, typeName);
  return {
    'content.ts': `import { defineGameContent${family.contentImports} } from '../../../core/application/public-api';

export const ${typeName}Content = defineGameContent(${quote(code)}, ${family.content});
`,
    'rules.ts': `import { passTurn } from '../../../core/application/public-api';

export type ${typeName}State = Record<string, never>;
export const ${typeName}Actions = { pass: passTurn<${typeName}State>() };
`,
    'game.ts': `import { clockwise, defineGame${family.gameImports} } from '../../../core/application/public-api';
import { ${typeName}Content } from './content';
import { ${typeName}Actions, type ${typeName}State } from './rules';

${family.declaration}

export default defineGame<${typeName}State, typeof ${typeName}Actions>({
  id: ${quote(code)},
  displayName: ${quote(name)},
  category: ${quote(category)},
  subcategory: ${quote(world)},
  description: ${quote(`Règles de ${name} à compléter.`)},
  content: ${typeName}Content,
  players: { min: ${minPlayers}, max: ${maxPlayers} },
  ${family.definition}
  turn: ${family.turn},
  actions: ${typeName}Actions,
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

    expect(await game.replay()).toEqual(game.state());
  });
});
`,
  };
}

function familyTemplate(template, typeName) {
  if (template === 'card') {
    return {
      contentImports: '',
      gameImports: ', cardGame',
      content: "{ cards: [{ id: 'example-card' }] }",
      declaration: `const pattern = cardGame<${typeName}State, { id: string }>({
  cards: ${typeName}Content.data.cards,
  initialHandSize: 1,
});`,
      definition: 'components: pattern.components,\n  lifecycle: pattern.lifecycle,',
      turn: 'pattern.turn ?? clockwise()',
    };
  }
  if (template === 'race') {
    return {
      contentImports: '',
      gameImports: ', raceGame',
      content: '{ trackLength: 32 }',
      declaration: `const pattern = raceGame<${typeName}State>({ spaces: ${typeName}Content.data.trackLength });`,
      definition: 'components: pattern.components,',
      turn: 'pattern.turn ?? clockwise()',
    };
  }
  if (template === 'quiz') {
    return {
      contentImports: ', quizContent',
      gameImports: ', quiz',
      content:
        "{ questions: quizContent([{ id: 'example', prompt: 'À compléter', choices: ['A', 'B'], answerIndex: 0 }]) }",
      declaration: '',
      definition: `components: [quiz.bank({ id: 'main', questions: ${typeName}Content.data.questions })],`,
      turn: 'clockwise()',
    };
  }
  if (template === 'party') {
    return {
      contentImports: '',
      gameImports: ', simultaneousAnswers',
      content: '{ prompts: [] as string[] }',
      declaration: `const pattern = simultaneousAnswers<${typeName}State>();`,
      definition: '',
      turn: 'pattern.turn ?? clockwise()',
    };
  }
  if (template === 'board') {
    return {
      contentImports: '',
      gameImports: ', grid',
      content: '{ width: 8, height: 8 }',
      declaration: '',
      definition: `components: [grid.board({ id: 'main', width: ${typeName}Content.data.width, height: ${typeName}Content.data.height })],`,
      turn: 'clockwise()',
    };
  }
  return {
    contentImports: '',
    gameImports: '',
    content: '{}',
    declaration: '',
    definition: '',
    turn: 'clockwise()',
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
    template: parsed.options.template ?? 'empty',
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
      'Usage: npm run game:create -- <code> --world <monde> [--template empty|card|race|quiz|party|board] [--name <nom>] [--min 2] [--max 4]',
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

module.exports = {
  GAME_TEMPLATES,
  GENERATED_FILES,
  createGame,
  parseArguments,
  templates,
};
