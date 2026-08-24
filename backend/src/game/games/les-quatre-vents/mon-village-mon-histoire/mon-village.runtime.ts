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
import { MonVillageActionService } from './application/services/mon-village-action.service';
import { MonVillageBotService } from './application/services/mon-village-bot.service';
import { MonVillagePresenterService } from './application/services/mon-village-presenter.service';
import { MonVillageSetupService } from './application/services/mon-village-setup.service';
import { MonVillageService } from './application/services/mon-village-mon-histoire.service';

type MinimalContentLoader = Pick<GameContentLoaderService, 'loadContent' | 'validators'>;

function createDefaultContentLoader(): MinimalContentLoader {
  return {
    validators: {
      version: () => () => undefined,
      arrayField: () => () => undefined,
    },
    loadContent: () => {
      throw new Error(
        'MonVillage runtime requires a contentLoader override for content-dependent flows.',
      );
    },
  };
}

export function createMonVillageRuntime(
  overrides: {
    contentLoader?: MinimalContentLoader;
    random?: RandomService;
    core?: GameCoreService;
    turns?: TurnFlowService;
    deckPolicies?: DeckPoliciesService;
    boardPayload?: BoardPayloadService;
    botRunner?: BotRunnerService;
  } = {},
): { service: MonVillageService } {
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
  const setup = new MonVillageSetupService(
    contentLoader as GameContentLoaderService,
    random,
  );
  const actions = new MonVillageActionService(random, turns, core, deckPolicies);
  const presenter = new MonVillagePresenterService(boardPayload);
  const bots = new MonVillageBotService(botRunner);

  return {
    service: new MonVillageService(setup, actions, presenter, bots),
  };
}
