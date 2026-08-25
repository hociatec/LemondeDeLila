import { BoardEffectsPoliciesService } from '../../../board-effects-policies/application/services/board-effects-policies.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { GameContentLoaderService } from '../../../core/application/services/game-content-loader.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { FrousseActionService } from './application/services/frousse-action.service';
import { FrousseBotService } from './application/services/frousse-bot.service';
import { FroussePresenterService } from './application/services/frousse-presenter.service';
import { FroussePartyService } from './application/services/frousse-party.service';
import { FrousseSetupService } from './application/services/frousse-setup.service';

type MinimalContentLoader = Pick<
  GameContentLoaderService,
  'loadContent' | 'validators'
>;

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
        'Frousse runtime requires a contentLoader override for content-dependent flows.',
      );
    },
  };
}

export function createFroussePartyRuntime(
  overrides: {
    contentLoader?: MinimalContentLoader;
    random?: RandomService;
    core?: GameCoreService;
    setupFlow?: SetupFlowService;
    turns?: TurnFlowService;
    boardEffects?: BoardEffectsPoliciesService;
    deckPolicies?: DeckPoliciesService;
    boardPayload?: BoardPayloadService;
    botRunner?: BotRunnerService;
  } = {},
): { service: FroussePartyService } {
  const contentLoader = overrides.contentLoader ?? createDefaultContentLoader();
  const random = overrides.random ?? new RandomService();
  const core = overrides.core ?? new GameCoreService();
  const setupFlow = overrides.setupFlow ?? new SetupFlowService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const boardEffects =
    overrides.boardEffects ?? new BoardEffectsPoliciesService();
  const deckPolicies =
    overrides.deckPolicies ?? new DeckPoliciesService(random);
  const boardPayload = overrides.boardPayload ?? new BoardPayloadService();
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService(random));
  const setup = new FrousseSetupService(
    core,
    contentLoader as GameContentLoaderService,
    random,
    setupFlow,
  );
  const actions = new FrousseActionService(
    random,
    turns,
    core,
    setupFlow,
    boardEffects,
    deckPolicies,
  );
  const presenter = new FroussePresenterService(boardPayload);
  const bots = new FrousseBotService(botRunner);

  return {
    service: new FroussePartyService(setup, actions, presenter, bots),
  };
}
