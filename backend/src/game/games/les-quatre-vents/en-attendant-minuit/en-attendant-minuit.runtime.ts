import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { TurnService } from '../../../application/services/turn.service';
import { PromptPoliciesService } from '../../../application/services/prompt-policies.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import type { GameCatalogReader } from '../../../application/ports/game-catalog.reader';
import { MinuitActionService } from './application/services/minuit-action.service';
import { MinuitBotService } from './application/services/minuit-bot.service';
import { EnAttendantMinuitService } from './application/services/en-attendant-minuit.service';
import { MinuitPresenterService } from './application/services/minuit-presenter.service';
import { MinuitSetupService } from './application/services/minuit-setup.service';

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

export function createMinuitRuntime(): { service: EnAttendantMinuitService } {
  const core = new GameCoreService();
  const contentLoader = createGameContentLoader();
  const random = new RandomService();
  const setupFlow = new SetupFlowService();
  const deckPolicies = new DeckPoliciesService(random);
  const turns = new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const turnPolicies = new TurnPoliciesService(core);
  const promptPolicies = new PromptPoliciesService(core);
  const boardPayload = new BoardPayloadService();
  const botRunner = new BotRunnerService(new BotStrategyService());
  const setup = new MinuitSetupService(core, contentLoader, random, setupFlow);
  const actions = new MinuitActionService(
    random,
    turns,
    core,
    setupFlow,
    deckPolicies,
    turnPolicies,
    promptPolicies,
  );
  const presenter = new MinuitPresenterService(boardPayload);
  const bots = new MinuitBotService(botRunner);

  return {
    service: new EnAttendantMinuitService(setup, actions, presenter, bots),
  };
}
