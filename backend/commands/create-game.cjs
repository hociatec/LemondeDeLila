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
  'manifest.json',
  'rules.md',
];
const JSON_ONLY_FILES = ['manifest.json', 'game.json', 'rules.md'];
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
    if (rawKey === 'json-only' && inlineValue == null && !['true', 'false'].includes(argv[index + 1])) {
      options[rawKey] = 'true';
      continue;
    }
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
    'manifest.json': JSON.stringify({code, name, engine: code, minPlayers, maxPlayers, summary: `Règles de ${name} à compléter.`}, null, 2) + '\n',
    'rules.md': `# ${name}\n\nRègles à compléter avant publication du jeu.\n`,
    'content.ts': `import { defineGameContent, gameInput${family.contentImports} } from '../../../engine/sdk/public-api';
import manifest from './manifest.json';

export const ${typeName}Content = defineGameContent(manifest.code, ${family.content}, { formatVersion: 1, schema: ${family.schema} });
`,
    'rules.ts': `import { defineAction, gameInput } from '../../../engine/sdk/public-api';

export type ${typeName}State = Record<string, never>;
export const ${typeName}Actions = { pass: defineAction<${typeName}State, Record<string, never>>({ input: gameInput.object({}), execute: ({ ctx }) => ctx.turn.end() }) };
`,
    'game.ts': `import { defineGame${family.gameImports} } from '../../../engine/sdk/public-api';
import manifest from './manifest.json';
import { ${typeName}Content } from './content';
import { ${typeName}Actions, type ${typeName}State } from './rules';

${family.declaration}

export default defineGame<${typeName}State>()({
  id: manifest.code,
  displayName: manifest.name,
  category: ${quote(category)},
  subcategory: ${quote(world)},
  description: manifest.summary,
  content: ${typeName}Content,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  ${family.definition}
  actions: ${typeName}Actions,
});
`,
    'game.spec.ts': `import { testGame } from '../../../engine/testing/public-api';
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

function jsonOnlyTemplates(configuration) {
  const { code, name, category = 'JeuxDePlateaux', world, minPlayers, maxPlayers } = configuration;
  return {
    'manifest.json': JSON.stringify({ code, name, engine: code, minPlayers, maxPlayers, summary: `Règles de ${name} à compléter.` }, null, 2) + '\n',
    'game.json': JSON.stringify({
      schemaVersion: 1, contentVersion: '1', definitionVersion: '1', category, world,
      components: [], setup: { firstPlayer: 'first', scores: 0 }, resourceIds: [],
      initialPhase: 'playing', phases: { playing: { actions: ['score'], terminal: true } },
      actions: { score: { effects: [{ kind: 'gain-score', amount: 1 }, { kind: 'complete-turn' }] } },
      victory: { kind: 'score-at-least', amount: 3 },
    }, null, 2) + '\n',
    'rules.md': `# ${name}\n\nÀ votre tour, gagnez un point. Le premier joueur à trois points gagne.\n`,
  };
}

function familyTemplate(template, typeName) {
  if (template === 'card') {
    return {
      contentImports: '',
      gameImports: ', cardGame, cards, defineCardsSchema',
      content: "{ cards: [{ id: 'example-card' }] }",
      schema: "gameInput.object({ cards: gameInput.array(gameInput.object({ id: gameInput.string({ min: 1, max: 128 }) }), { min: 1, max: 10000 }) })",
      declaration: `const schema = defineCardsSchema({
  decks: { main: cards.deck({ id: 'main', cards: ${typeName}Content.data.cards, shuffle: true }) },
  hands: { players: cards.hands({ id: 'players', deck: 'main', initial: 0, visibility: 'owner' }) },
});`,
      definition: "patterns: [cardGame({ schema, deckId: 'main', handId: 'players' })],",
    };
  }
  if (template === 'race') {
    return {
      contentImports: '',
      gameImports: ', raceGame',
      content: '{ trackLength: 32 }',
      schema: 'gameInput.object({ trackLength: gameInput.number({ integer: true, min: 2, max: 1000 }) })',
      declaration: '',
      definition: `patterns: [raceGame({ spaces: ${typeName}Content.data.trackLength })],`,
    };
  }
  if (template === 'quiz') {
    return {
      contentImports: ', quizContent',
      gameImports: ', quiz',
      content:
        "{ questions: quizContent([{ id: 'example', prompt: 'À compléter', choices: ['A', 'B'], answerIndex: 0 }]) }",
      schema: "{ parse(value: unknown) { const parsed = gameInput.object({ questions: gameInput.array(gameInput.object({ id: gameInput.string({ min: 1, max: 128 }), prompt: gameInput.string({ min: 1, max: 4000 }), choices: gameInput.array(gameInput.string({ min: 1, max: 1000 }), { min: 2, max: 20 }), answerIndex: gameInput.number({ integer: true, min: 0, max: 19 }) }), { min: 1, max: 10000 }) }).parse(value); return { questions: quizContent(parsed.questions) }; } }",
      declaration: '',
      definition: `components: [quiz.bank({ id: 'main', questions: ${typeName}Content.data.questions })],`,
    };
  }
  if (template === 'party') {
    return {
      contentImports: '',
      gameImports: ', simultaneousAnswers',
      content: '{ prompts: [] as string[] }',
      schema: 'gameInput.object({ prompts: gameInput.array(gameInput.string({ min: 1, max: 4000 }), { max: 10000 }) })',
      declaration: '',
      definition: 'patterns: [simultaneousAnswers()],',
    };
  }
  if (template === 'board') {
    return {
      contentImports: '',
      gameImports: ', gridGame',
      content: '{ width: 8, height: 8 }',
      schema: 'gameInput.object({ width: gameInput.number({ integer: true, min: 1, max: 100 }), height: gameInput.number({ integer: true, min: 1, max: 100 }) })',
      declaration: '',
      definition: `patterns: [gridGame({ boardId: 'main', width: ${typeName}Content.data.width, height: ${typeName}Content.data.height })],`,
    };
  }
  return {
    contentImports: '',
    gameImports: '',
    content: '{}',
    schema: 'gameInput.object({})',
    declaration: '',
    definition: '',
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
  const jsonOnly = configuration.jsonOnly === true;
  const contentByFile = jsonOnly ? jsonOnlyTemplates(configuration) : templates(configuration);
  for (const file of jsonOnly ? JSON_ONLY_FILES : GENERATED_FILES) {
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
    jsonOnly: parsed.options['json-only'] === 'true' || parsed.options['json-only'] === true,
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
