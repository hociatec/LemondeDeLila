import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { TurnService } from '../../../application/services/turn.service';
import { VoyageActionService } from './application/services/voyage-action.service';
import { VoyageBotService } from './application/services/voyage-bot.service';
import { VoyagePresenterService } from './application/services/voyage-presenter.service';
import { VoyageService } from './application/services/voyage.service';
import { VoyageSetupService } from './application/services/voyage-setup.service';

type MinimalContentLoader = Pick<GameContentLoaderService, 'loadContent' | 'validators'>;

export type VoyageRuntimeOverrides = {
  contentLoader?: MinimalContentLoader;
  random?: RandomService;
  core?: GameCoreService;
  turns?: TurnFlowService;
  deckPolicies?: DeckPoliciesService;
  boardPayload?: BoardPayloadService;
  botRunner?: BotRunnerService;
};

function createDefaultContentLoader(): MinimalContentLoader {
  return {
    validators: {
      version: () => () => undefined,
      arrayField: () => () => undefined,
    },
    loadContent: () => {
      throw new Error(
        'Voyage runtime requires a contentLoader override for content-dependent flows.',
      );
    },
  };
}

export function createVoyageRuntime(
  overrides: VoyageRuntimeOverrides = {},
): { service: VoyageService } {
  const contentLoader = overrides.contentLoader ?? createDefaultContentLoader();
  const random = overrides.random ?? new RandomService();
  const core = overrides.core ?? new GameCoreService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const deckPolicies = overrides.deckPolicies ?? new DeckPoliciesService(random);
  const boardPayload = overrides.boardPayload ?? new BoardPayloadService();
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const setup = new VoyageSetupService(
    contentLoader as GameContentLoaderService,
    random,
  );
  const actions = new VoyageActionService(random, turns, core, deckPolicies);
  const presenter = new VoyagePresenterService(boardPayload);
  const bots = new VoyageBotService(botRunner);

  return {
    service: new VoyageService(setup, actions, presenter, bots),
  };
}
