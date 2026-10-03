#!/usr/bin/env node
'use strict';

require('ts-node/register');
require('tsconfig-paths/register');

const fs = require('node:fs');
const path = require('node:path');
const { Logger } = require('@nestjs/common');
const { compileJsonGame } = require('../src/game/rules/public-api');
const {
  testGame,
  DeclarativeGameRuntime,
} = require('../src/game/engine/testing/public-api');
const {
  GameVisibilityService,
} = require('../src/game/core/application/services/game-visibility.service');
const {
  GameWsStatePresenter,
} = require('../src/game/core/infrastructure/presentation/ws/state/game-ws-state.presenter');

Logger.overrideLogger(false);

const fixturePath = path.resolve(
  __dirname,
  '../../client-wx/tests/fixtures/post-configuration-game-states.json',
);

function definition(manifestPath, documentPath, assets = {}) {
  return compileJsonGame(require(manifestPath), require(documentPath), assets);
}

function stateEvent(gameDefinition, state, gameType) {
  const presenter = new GameWsStatePresenter(new GameVisibilityService());
  return {
    type: 'game.state',
    payload: presenter.present({
      state,
      handler: new DeclarativeGameRuntime(gameDefinition),
      roomId: 1,
      gameType,
      version: Number(state.version ?? 0),
      viewerPlayerId: 1,
    }),
  };
}

function acknowledgement(gameType) {
  return {
    type: 'game.ack',
    payload: {
      action: 'game.action',
      commandId: `${gameType}:configure`,
      ok: true,
    },
  };
}

async function configuredCycle(gameType, gameDefinition, configuration, seed) {
  const game = await testGame(gameDefinition)
    .players(['Lila', 'Mina'])
    .seed(seed)
    .start();
  const before = stateEvent(gameDefinition, game.state(), gameType);
  await game.as(1).do('game.configure', configuration);
  return {
    game,
    cycle: {
      before,
      acknowledgement: acknowledgement(gameType),
      afterConfiguration: stateEvent(gameDefinition, game.state(), gameType),
    },
  };
}

async function buildContract() {
  const lamaDefinition = definition(
    '../src/game/games/vents-sacres/lama/manifest.json',
    '../src/game/games/vents-sacres/lama/game.json',
  );
  const corridorDefinition = definition(
    '../src/game/games/vents-sacres/corridor/manifest.json',
    '../src/game/games/vents-sacres/corridor/game.json',
  );
  const archeDefinition = definition(
    '../src/game/games/vents-infinis/arche-de-mnemosyne/manifest.json',
    '../src/game/games/vents-infinis/arche-de-mnemosyne/game.json',
    {
      'content/quiz.json': require('../src/game/games/vents-infinis/arche-de-mnemosyne/quiz.json'),
    },
  );
  const lama = await configuredCycle('lama', lamaDefinition, {}, 73);
  const corridor = await configuredCycle(
    'corridor',
    corridorDefinition,
    { wallsPerPlayer: 10 },
    71,
  );
  await corridor.game.choose(1, 'vent');
  const corridorAfterChoice = stateEvent(
    corridorDefinition,
    corridor.game.state(),
    'corridor',
  );
  await corridor.game.choose(2, 'eau');
  const corridorAfterSetup = stateEvent(
    corridorDefinition,
    corridor.game.state(),
    'corridor',
  );
  const arche = await configuredCycle(
    'arche-de-mnemosyne',
    archeDefinition,
    {
      categoryId: 'all',
      questionsPerRound: 5,
      targetPoints: 20,
      useTimer: false,
      timerSeconds: 30,
      interQuestionSeconds: 0,
      correctSoloPoints: 2,
      correctMultiPoints: 1,
      wrongPoints: 0,
      timeoutPoints: -1,
    },
    127,
  );
  return {
    contractVersion: 1,
    lama: lama.cycle,
    corridor: {
      ...corridor.cycle,
      afterChoice: corridorAfterChoice,
      afterSetup: corridorAfterSetup,
    },
    arche: arche.cycle,
  };
}

async function main() {
  const serialized = `${JSON.stringify(await buildContract(), null, 2)}\n`;
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, serialized, 'utf8');
    process.stdout.write(`post-config-client-contract: wrote ${fixturePath}\n`);
    return;
  }
  if (
    !fs.existsSync(fixturePath) ||
    fs.readFileSync(fixturePath, 'utf8') !== serialized
  ) {
    throw new Error(
      'Le contrat post-configuration backend/client a dérivé; exécutez npm run contract:post-config:write.',
    );
  }
  process.stdout.write('post-config-client-contract: OK\n');
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
