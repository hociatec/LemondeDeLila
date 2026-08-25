import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { GameContentLoaderService } from '../../../core/application/services/game-content-loader.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { ToutPresDeMamanActionService } from './application/services/tout-pres-de-maman-action.service';
import { ToutPresDeMamanBotService } from './application/services/tout-pres-de-maman-bot.service';
import { ToutPresDeMamanPresenterService } from './application/services/tout-pres-de-maman-presenter.service';
import { ToutPresDeMamanService } from './application/services/tout-pres-de-maman.service';
import { ToutPresDeMamanSetupService } from './application/services/tout-pres-de-maman-setup.service';

type MinimalContentLoader = Pick<
  GameContentLoaderService,
  'loadContent' | 'validators'
>;

export type ToutPresDeMamanRuntimeOverrides = {
  contentLoader?: MinimalContentLoader;
  random?: RandomService;
  core?: GameCoreService;
  turns?: TurnFlowService;
  deckPolicies?: DeckPoliciesService;
  boardPayload?: BoardPayloadService;
  botRunner?: BotRunnerService;
};

export type ToutPresDeMamanRuntime = {
  service: ToutPresDeMamanService;
};

function createDefaultContentLoader(): MinimalContentLoader {
  return {
    validators: {
      version: () => () => undefined,
      arrayField: () => () => undefined,
      requiredFields: () => () => undefined,
      positiveNumber: () => () => undefined,
    },
    loadContent: () => {
      throw new Error(
        'ToutPresDeMaman runtime requires a contentLoader override for content-dependent flows.',
      );
    },
  };
}

export function createToutPresDeMamanRuntime(
  overrides: ToutPresDeMamanRuntimeOverrides = {},
): ToutPresDeMamanRuntime {
  const contentLoader = overrides.contentLoader ?? createDefaultContentLoader();
  const random = overrides.random ?? new RandomService();
  const core = overrides.core ?? new GameCoreService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const deckPolicies =
    overrides.deckPolicies ?? new DeckPoliciesService(random);
  const boardPayload = overrides.boardPayload ?? new BoardPayloadService();
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const setup = new ToutPresDeMamanSetupService(
    contentLoader as GameContentLoaderService,
    random,
  );
  const actions = new ToutPresDeMamanActionService(
    core,
    random,
    turns,
    deckPolicies,
  );
  const presenter = new ToutPresDeMamanPresenterService(boardPayload);
  const bots = new ToutPresDeMamanBotService(botRunner);

  return {
    service: new ToutPresDeMamanService(setup, actions, presenter, bots),
  };
}
