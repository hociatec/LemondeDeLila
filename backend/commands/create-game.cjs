#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function kebabToPascal(value) {
  return String(value)
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function pascalToConst(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();
}

function normalizeInt(value, fallback) {
  const asNumber = Number.parseInt(String(value), 10);
  return Number.isFinite(asNumber) ? asNumber : fallback;
}

async function pathExists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeFileIfMissing(filePath, content) {
  if (await pathExists(filePath)) return;
  await fsp.writeFile(filePath, content, 'utf8');
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage:');
    console.log('  npm run create:game');
    console.log('');
    console.log('Crée un nouveau jeu sous `src/game/games/<type>/<monde>/<code>/`');
    return;
  }

  if (!process.stdin.isTTY) {
    console.error('Ce script nécessite un terminal interactif (TTY).');
    process.exitCode = 1;
    return;
  }

  const cwd = process.cwd();
  const srcDir = path.resolve(cwd, 'src');
  const gamesRoot = path.resolve(cwd, 'src', 'game', 'games');

  if (!fs.existsSync(srcDir) || !fs.existsSync(gamesRoot)) {
    console.error(
      "Ce script doit être lancé depuis `backend/` (ex: `cd backend && npm run create:game`).",
    );
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('Création d’un nouveau jeu (architecture commune)\n');

    const code = (await rl.question(
      'Code du jeu (kebab-case, ex: foulees-fantastiques) : ',
    ))
      .trim()
      .toLowerCase();
    if (!KEBAB_RE.test(code)) {
      throw new Error(`Code invalide "${code}" (attendu: kebab-case).`);
    }

    const name =
      (await rl.question('Nom affiché (ex: Foulées Fantastiques !) : ')).trim() ||
      kebabToPascal(code);

    console.log('\nType de jeu :');
    console.log('1) actions');
    console.log('2) jeux-de-cartes');
    console.log('3) jeux-de-plateaux');
    const familyChoice = (await rl.question('Choix (1/2/3) : ')).trim();
    const family =
      familyChoice === '1'
        ? 'actions'
        : familyChoice === '2'
          ? 'jeux-de-cartes'
          : familyChoice === '3'
            ? 'jeux-de-plateaux'
            : null;
    if (!family) throw new Error('Choix invalide (attendu 1/2/3).');

    const world = (await rl.question(
      'Monde/sous-catalogue (kebab-case, ex: vents-dansants) : ',
    ))
      .trim()
      .toLowerCase();
    if (!KEBAB_RE.test(world)) {
      throw new Error(`Monde invalide "${world}" (attendu: kebab-case).`);
    }

    const minPlayers = normalizeInt(await rl.question('minPlayers (ex: 2) : '), 2);
    const maxPlayers = normalizeInt(await rl.question('maxPlayers (ex: 6) : '), Math.max(minPlayers, 4));
    if (minPlayers <= 0 || maxPlayers <= 0 || maxPlayers < minPlayers) {
      throw new Error('min/max players invalides.');
    }

    const summary =
      (await rl.question('Résumé court (1 phrase) : ')).trim() || 'Jeu (WIP).';

    const defaultCategory =
      family === 'actions'
        ? 'Actions'
        : family === 'jeux-de-cartes'
          ? 'JeuxDeCartes'
          : 'JeuxDePlateaux';
    const defaultSubcategory = kebabToPascal(world);
    const category =
      (await rl.question(`Category handler (défaut: ${defaultCategory}) : `)).trim() ||
      defaultCategory;
    const subcategory =
      (await rl.question(
        `Subcategory handler (défaut: ${defaultSubcategory}) : `,
      )).trim() || defaultSubcategory;

    console.log('\nData JSON (model/content) :');
    console.log('1) quizzes.json');
    console.log('2) cards.json');
    console.log('3) board.json');
    console.log('Laisser vide pour aucun, ou entrer une liste "1,3".');
    const dataChoice = (await rl.question('Choix : ')).trim();
    const dataSelected = new Set(
      dataChoice
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );

    const relGameDir = path.join('src', 'game', 'games', family, world, code);
    const absGameDir = path.resolve(cwd, relGameDir);

    console.log('\nRésumé :');
    console.log(`- Dossier : ${toPosix(relGameDir)}`);
    console.log(`- code/name : ${code} / ${name}`);
    console.log(`- players : ${minPlayers}..${maxPlayers}`);
    console.log(`- handler : ${category} / ${subcategory}`);
    const confirm = (await rl.question('Créer ce jeu ? (o/N) : ')).trim().toLowerCase();
    if (confirm !== 'o' && confirm !== 'oui' && confirm !== 'y' && confirm !== 'yes') {
      console.log('Annulé.');
      return;
    }

    if (await pathExists(absGameDir)) {
      throw new Error(`Le dossier existe déjà : ${toPosix(relGameDir)}`);
    }

    const gamePascal = kebabToPascal(code);
    const gameConst = pascalToConst(gamePascal);

    const dirs = [
      'actions',
      'bots',
      'definitions',
      path.join('model', 'content'),
      'phases',
      'presenter',
      'rulebook',
      'setup',
      'tests',
    ];
    for (const d of dirs) {
      await ensureDir(path.join(absGameDir, d));
    }

    const relFromDefinitionsToEngine = toPosix(
      path.relative(
        path.join(absGameDir, 'definitions'),
        path.resolve(cwd, 'src', 'game', 'engine'),
      ),
    );
    const relFromGameRootToEngine = toPosix(
      path.relative(absGameDir, path.resolve(cwd, 'src', 'game', 'engine')),
    );
    const relFromGameRootToCore = toPosix(
      path.relative(absGameDir, path.resolve(cwd, 'src', 'game', 'core')),
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'manifest.json'),
      `${JSON.stringify(
        {
          code,
          name,
          minPlayers,
          maxPlayers,
          engine: code,
          summary,
        },
        null,
        2,
      )}\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'rules.md'),
      `# ${name} — Règles (WIP)\n\nDocument de règles en cours de rédaction.\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, `${code}.module.ts`),
      `import { Module } from '@nestjs/common';\n` +
        `import { GameCoreModule } from '${relFromGameRootToCore}/core.module';\n` +
        `import { GameRegistryModule } from '${relFromGameRootToEngine}/game-registry.module';\n` +
        `import { ${gamePascal}Service } from './${code}.service';\n` +
        `import { ${gamePascal}SetupService } from './setup/${code}-setup.service';\n` +
        `import { ${gamePascal}ActionService } from './actions/${code}-action.service';\n` +
        `import { ${gamePascal}PhaseService } from './phases/${code}-phase.service';\n` +
        `import { ${gamePascal}PresenterService } from './presenter/${code}-presenter.service';\n\n` +
        `@Module({\n` +
        `  imports: [GameCoreModule, GameRegistryModule],\n` +
        `  providers: [\n` +
        `    ${gamePascal}Service,\n` +
        `    ${gamePascal}SetupService,\n` +
        `    ${gamePascal}ActionService,\n` +
        `    ${gamePascal}PhaseService,\n` +
        `    ${gamePascal}PresenterService,\n` +
        `  ],\n` +
        `  exports: [${gamePascal}Service],\n` +
        `})\n` +
        `export class ${gamePascal}Module {}\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, `${code}.service.ts`),
      `import { Injectable, OnModuleInit } from '@nestjs/common';\n` +
        `import type { GameStateEntity } from '${relFromGameRootToCore}/entities/game-state.entity';\n` +
        `import type { GameSingleActionDto, GameStateWithActions } from '${relFromGameRootToEngine}/dto/game-action.dto';\n` +
        `import type { GameRulesAdapter } from '${relFromGameRootToEngine}/interfaces/game-rules-adapter.interface';\n` +
        `import { GameRegistryService } from '${relFromGameRootToEngine}/services/game-registry.service';\n` +
        `import * as ${gamePascal}Rulebook from './rulebook/rulebook';\n` +
        `import { ${gamePascal}ActionService } from './actions/${code}-action.service';\n` +
        `import { ${gamePascal}PhaseService } from './phases/${code}-phase.service';\n` +
        `import { ${gamePascal}PresenterService } from './presenter/${code}-presenter.service';\n` +
        `import { ${gamePascal}SetupService } from './setup/${code}-setup.service';\n` +
        `import { ${gameConst}_GAME } from './definitions/game.definition';\n\n` +
        `@Injectable()\n` +
        `export class ${gamePascal}Service implements GameRulesAdapter, OnModuleInit {\n` +
        `  readonly gameType = '${code}';\n` +
        `  readonly category = '${category}';\n` +
        `  readonly subcategory = '${subcategory}';\n` +
        `  readonly displayName = ${gameConst}_GAME.displayName;\n` +
        `  readonly description = '${summary.replace(/'/g, "\\'")}';\n` +
        `  readonly minPlayers = ${gameConst}_GAME.minPlayers;\n` +
        `  readonly maxPlayers = ${gameConst}_GAME.maxPlayers;\n\n` +
        `  constructor(\n` +
        `    private readonly registry: GameRegistryService,\n` +
        `    private readonly setup: ${gamePascal}SetupService,\n` +
        `    private readonly actions: ${gamePascal}ActionService,\n` +
        `    private readonly phases: ${gamePascal}PhaseService,\n` +
        `    private readonly presenter: ${gamePascal}PresenterService,\n` +
        `  ) {}\n\n` +
        `  onModuleInit(): void {\n` +
        `    this.registry.register(this);\n` +
        `  }\n\n` +
        `  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {\n` +
        `    return this.setup.hydrateInitialState(baseState);\n` +
        `  }\n\n` +
        `  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {\n` +
        `    const next = this.actions.applyActions(state, actions);\n` +
        `    return this.phases.advance(next);\n` +
        `  }\n\n` +
        `  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {\n` +
        `    return ${gamePascal}Rulebook.getAvailableActions(state, playerId);\n` +
        `  }\n\n` +
        `  validateAction(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameSingleActionDto {\n` +
        `    return ${gamePascal}Rulebook.validateAction(state, action, actorId);\n` +
        `  }\n\n` +
        `  exposeState(state: GameStateEntity): GameStateWithActions {\n` +
        `    return this.presenter.exposeState(state);\n` +
        `  }\n` +
        `}\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'definitions', 'victory.definition.ts'),
      `export const ${gameConst}_VICTORY = null as const;\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'definitions', 'game.definition.ts'),
      `import type { GameDefinition } from '${relFromDefinitionsToEngine}/model/game-definition.model';\n` +
        `import { ${gameConst}_VICTORY } from './victory.definition';\n\n` +
        `export type ${gamePascal}GameId = '${code}';\n` +
        `export type ${gamePascal}PhaseId = 'turn';\n` +
        `export type ${gamePascal}ActionType = never;\n\n` +
        `export const ${gameConst}_GAME: GameDefinition<\n` +
        `  ${gamePascal}GameId,\n` +
        `  never,\n` +
        `  ${gamePascal}ActionType,\n` +
        `  ${gamePascal}PhaseId,\n` +
        `  typeof ${gameConst}_VICTORY\n` +
        `> = {\n` +
        `  id: '${code}',\n` +
        `  displayName: '${name.replace(/'/g, "\\'")}',\n` +
        `  minPlayers: ${minPlayers},\n` +
        `  maxPlayers: ${maxPlayers},\n` +
        `  roles: [],\n` +
        `  actions: [],\n` +
        `  phaseOrder: [{ id: 'turn', kind: 'player-action' }],\n` +
        `  victory: ${gameConst}_VICTORY,\n` +
        `} as const;\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'definitions', 'rules.definition.ts'),
      `import { GameStateEntity } from '${relFromDefinitionsToEngine}/../core/entities/game-state.entity';\n` +
        `import { ${gameConst}_GAME } from './game.definition';\n\n` +
        `export const ${gameConst}_PHASES: Array<{\n` +
        `  id: string;\n` +
        `  onEnter?: (state: GameStateEntity) => GameStateEntity;\n` +
        `}> = [{ id: ${gameConst}_GAME.phaseOrder[0].id }];\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'setup', `${code}-setup.service.ts`),
      `import { Injectable } from '@nestjs/common';\n` +
        `import type { GameStateEntity } from '${relFromGameRootToCore}/entities/game-state.entity';\n\n` +
        `@Injectable()\n` +
        `export class ${gamePascal}SetupService {\n` +
        `  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {\n` +
        `    return baseState;\n` +
        `  }\n` +
        `}\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'actions', `${code}-action.service.ts`),
      `import { Injectable } from '@nestjs/common';\n` +
        `import type { GameStateEntity } from '${relFromGameRootToCore}/entities/game-state.entity';\n` +
        `import type { GameSingleActionDto } from '${relFromGameRootToEngine}/dto/game-action.dto';\n\n` +
        `@Injectable()\n` +
        `export class ${gamePascal}ActionService {\n` +
        `  applyActions(state: GameStateEntity, _actions: GameSingleActionDto[]): GameStateEntity {\n` +
        `    return state;\n` +
        `  }\n` +
        `}\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'phases', `${code}-phase.service.ts`),
      `import { Injectable } from '@nestjs/common';\n` +
        `import type { GameStateEntity } from '${relFromGameRootToCore}/entities/game-state.entity';\n\n` +
        `@Injectable()\n` +
        `export class ${gamePascal}PhaseService {\n` +
        `  advance(state: GameStateEntity): GameStateEntity {\n` +
        `    return state;\n` +
        `  }\n` +
        `}\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'presenter', `${code}-presenter.service.ts`),
      `import { Injectable } from '@nestjs/common';\n` +
        `import type { GameStateEntity } from '${relFromGameRootToCore}/entities/game-state.entity';\n` +
        `import type { GameStateWithActions } from '${relFromGameRootToEngine}/dto/game-action.dto';\n\n` +
        `@Injectable()\n` +
        `export class ${gamePascal}PresenterService {\n` +
        `  exposeState(state: GameStateEntity): GameStateWithActions {\n` +
        `    return { ...state, actions: [] };\n` +
        `  }\n` +
        `}\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'rulebook', 'rulebook.ts'),
      `import type { GameStateEntity } from '${relFromGameRootToCore}/entities/game-state.entity';\n` +
        `import type { GameSingleActionDto } from '${relFromGameRootToEngine}/dto/game-action.dto';\n\n` +
        `export function getAvailableActions(\n` +
        `  _state: GameStateEntity,\n` +
        `  _playerId: number,\n` +
        `): GameSingleActionDto[] {\n` +
        `  return [];\n` +
        `}\n\n` +
        `export function validateAction(\n` +
        `  _state: GameStateEntity,\n` +
        `  action: GameSingleActionDto,\n` +
        `  _actorId: number | null,\n` +
        `): GameSingleActionDto {\n` +
        `  return action;\n` +
        `}\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'tests', `${code}.service.spec.ts`),
      `import { Test } from '@nestjs/testing';\n` +
        `import { ${gamePascal}Module } from '../${code}.module';\n` +
        `import { ${gamePascal}Service } from '../${code}.service';\n\n` +
        `describe('${gamePascal}Service', () => {\n` +
        `  it('hydrates and exposes without actions', async () => {\n` +
        `    const moduleRef = await Test.createTestingModule({\n` +
        `      imports: [${gamePascal}Module],\n` +
        `    }).compile();\n` +
        `    const service = moduleRef.get(${gamePascal}Service);\n` +
        `    const state: any = service.hydrateInitialState({\n` +
        `      players: [{ id: 1, username: 'A' }],\n` +
        `    } as any);\n` +
        `    const exposed: any = service.exposeState(state);\n` +
        `    expect(exposed.actions ?? []).toHaveLength(0);\n` +
        `  });\n` +
        `});\n`,
    );

    await writeFileIfMissing(
      path.join(absGameDir, 'tests', `${code}.scenario.spec.ts`),
      `import { Test } from '@nestjs/testing';\n` +
        `import { ${gamePascal}Module } from '../${code}.module';\n` +
        `import { ${gamePascal}Service } from '../${code}.service';\n\n` +
        `describe('${gamePascal} scenario', () => {\n` +
        `  it('applies empty action list', async () => {\n` +
        `    const moduleRef = await Test.createTestingModule({\n` +
        `      imports: [${gamePascal}Module],\n` +
        `    }).compile();\n` +
        `    const service = moduleRef.get(${gamePascal}Service);\n` +
        `    const initial: any = service.hydrateInitialState({\n` +
        `      status: 'started',\n` +
        `      players: [{ id: 1, username: 'A' }],\n` +
        `    } as any);\n` +
        `    const next: any = service.applyActions(initial, [] as any);\n` +
        `    expect(next).toBeTruthy();\n` +
        `  });\n` +
        `});\n`,
    );

    if (dataSelected.size > 0) {
      const contentDir = path.join(absGameDir, 'model', 'content');
      if (dataSelected.has('1')) {
        await writeFileIfMissing(path.join(contentDir, 'quizzes.json'), '[]\n');
      }
      if (dataSelected.has('2')) {
        await writeFileIfMissing(path.join(contentDir, 'cards.json'), '[]\n');
      }
      if (dataSelected.has('3')) {
        await writeFileIfMissing(path.join(contentDir, 'board.json'), 'null\n');
      }
    }

    console.log(`\nOK: jeu créé dans ${toPosix(relGameDir)}`);
    console.log('Étapes suivantes :');
    console.log(`- Ajouter les vraies règles dans ${toPosix(path.join(relGameDir, 'rulebook', 'rulebook.ts'))}`);
    console.log(`- Mettre la data dans ${toPosix(path.join(relGameDir, 'model', 'content'))}`);
    console.log('- Lancer les tests : npm test');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`Erreur: ${err?.message ?? String(err)}`);
  process.exitCode = 1;
});
