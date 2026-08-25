import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { GameContentLoaderService } from '../../../core/application/services/game-content-loader.service';
import type { GameCatalogReader } from '../../../core/application/ports/game-catalog.reader';
import { GaloponsActionService } from './application/services/galopons-action.service';
import { GaloponsBotService } from './application/services/galopons-bot.service';
import { GaloponsEnsembleService } from './application/services/galopons-ensemble.service';
import { GaloponsPresenterService } from './application/services/galopons-presenter.service';
import { GaloponsSetupService } from './application/services/galopons-setup.service';

function createGameContentLoader(): GameContentLoaderService {
  const catalogReader: GameCatalogReader = {
    listEntries: () => [],
    loadJsonFile: <T>(params: {
      baseDir: string;
      contentDir?: string;
      filename: string;
    }): T => {
      const filePath = path.join(
        params.baseDir,
        params.contentDir ?? '',
        params.filename,
      );
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    },
    readTextFile: (filePath: string) => fs.readFileSync(filePath, 'utf8'),
  };

  return new GameContentLoaderService(catalogReader);
}

export function createGaloponsRuntime(): { service: GaloponsEnsembleService } {
  const core = new GameCoreService();
  const contentLoader = createGameContentLoader();
  const random = new RandomService();
  const setupFlow = new SetupFlowService();
  const deckPolicies = new DeckPoliciesService(random);
  const turns = new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const boardPayload = new BoardPayloadService();
  const botRunner = new BotRunnerService(new BotStrategyService());
  const setup = new GaloponsSetupService(core, contentLoader, random, setupFlow);
  const actions = new GaloponsActionService(
    random,
    turns,
    core,
    deckPolicies,
    setupFlow,
  );
  const presenter = new GaloponsPresenterService(boardPayload);
  const bots = new GaloponsBotService(botRunner);

  return {
    service: new GaloponsEnsembleService(setup, actions, presenter, bots),
  };
}
