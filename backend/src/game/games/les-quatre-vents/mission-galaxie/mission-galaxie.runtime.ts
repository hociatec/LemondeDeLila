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
import { MissionGalaxieActionService } from './application/services/mission-galaxie-action.service';
import { MissionGalaxieBotService } from './application/services/mission-galaxie-bot.service';
import { MissionGalaxiePresenterService } from './application/services/mission-galaxie-presenter.service';
import { MissionGalaxieService } from './application/services/mission-galaxie.service';
import { MissionGalaxieSetupService } from './application/services/mission-galaxie-setup.service';

type MinimalContentLoader = Pick<
  GameContentLoaderService,
  'loadContent' | 'validators'
>;

export type MissionGalaxieRuntimeOverrides = {
  contentLoader?: MinimalContentLoader;
  random?: RandomService;
  turns?: TurnFlowService;
  core?: GameCoreService;
  deckPolicies?: DeckPoliciesService;
  boardPayload?: BoardPayloadService;
  botRunner?: BotRunnerService;
  setup?: MissionGalaxieSetupService;
  actions?: MissionGalaxieActionService;
  presenter?: MissionGalaxiePresenterService;
  bots?: MissionGalaxieBotService;
};

export type MissionGalaxieRuntime = {
  service: MissionGalaxieService;
  contentLoader: MinimalContentLoader;
  random: RandomService;
  turns: TurnFlowService;
  core: GameCoreService;
  deckPolicies: DeckPoliciesService;
  boardPayload: BoardPayloadService;
  botRunner: BotRunnerService;
  setup: MissionGalaxieSetupService;
  actions: MissionGalaxieActionService;
  presenter: MissionGalaxiePresenterService;
  bots: MissionGalaxieBotService;
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
        'MissionGalaxie runtime requires a contentLoader override for content-dependent flows.',
      );
    },
  };
}

export function createMissionGalaxieRuntime(
  overrides: MissionGalaxieRuntimeOverrides = {},
): MissionGalaxieRuntime {
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
  const setup =
    overrides.setup ??
    new MissionGalaxieSetupService(
      contentLoader as GameContentLoaderService,
      random,
    );
  const actions =
    overrides.actions ??
    new MissionGalaxieActionService(random, turns, core, deckPolicies);
  const presenter =
    overrides.presenter ?? new MissionGalaxiePresenterService(boardPayload);
  const bots = overrides.bots ?? new MissionGalaxieBotService(botRunner);

  return {
    service: new MissionGalaxieService(setup, actions, presenter, bots),
    contentLoader,
    random,
    turns,
    core,
    deckPolicies,
    boardPayload,
    botRunner,
    setup,
    actions,
    presenter,
    bots,
  };
}
