import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { GameContentLoaderService } from '../../../core/application/services/game-content-loader.service';
import type { GameCatalogReader } from '../../../core/application/ports/game-catalog.reader';
import { AFondLesBallonsActionService } from './application/services/a-fond-les-ballons-action.service';
import { AFondLesBallonsBotService } from './application/services/a-fond-les-ballons-bot.service';
import { AFondLesBallonsPresenterService } from './application/services/a-fond-les-ballons-presenter.service';
import { AFondLesBallonsService } from './application/services/a-fond-les-ballons.service';
import { AFondLesBallonsSetupService } from './application/services/a-fond-les-ballons-setup.service';

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

export function createAFondLesBallonsRuntime(
  overrides: {
    core?: GameCoreService;
    random?: RandomService;
    turns?: TurnFlowService;
    deckPolicies?: DeckPoliciesService;
    setupFlow?: SetupFlowService;
    boardPayload?: BoardPayloadService;
    botRunner?: BotRunnerService;
    contentLoader?: GameContentLoaderService;
  } = {},
): { service: AFondLesBallonsService } {
  const core = overrides.core ?? new GameCoreService();
  const random = overrides.random ?? new RandomService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const deckPolicies =
    overrides.deckPolicies ?? new DeckPoliciesService(random);
  const setupFlow = overrides.setupFlow ?? new SetupFlowService();
  const boardPayload = overrides.boardPayload ?? new BoardPayloadService();
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const contentLoader = overrides.contentLoader ?? createGameContentLoader();

  const setup = new AFondLesBallonsSetupService(
    core,
    random,
    contentLoader,
    setupFlow,
  );
  const actions = new AFondLesBallonsActionService(
    core,
    random,
    turns,
    deckPolicies,
    setupFlow,
  );
  const presenter = new AFondLesBallonsPresenterService(boardPayload);
  const bots = new AFondLesBallonsBotService(botRunner);

  return {
    service: new AFondLesBallonsService(setup, actions, presenter, bots),
  };
}
