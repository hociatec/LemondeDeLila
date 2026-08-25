import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { DameNatureActionService } from './application/services/dame-nature-action.service';
import { DameNatureBotService } from './application/services/dame-nature-bot.service';
import { DameNaturePresenterService } from './application/services/dame-nature-presenter.service';
import { DameNatureSetupService } from './application/services/dame-nature-setup.service';
import { DameNatureService } from './application/services/dame-nature.service';

export type DameNatureRuntimeOverrides = {
  random?: RandomService;
  core?: GameCoreService;
  turns?: TurnFlowService;
  deckPolicies?: DeckPoliciesService;
  botRunner?: BotRunnerService;
  setup?: DameNatureSetupService;
  actions?: DameNatureActionService;
  presenter?: DameNaturePresenterService;
  bots?: DameNatureBotService;
};

export type DameNatureRuntime = {
  service: DameNatureService;
  random: RandomService;
  core: GameCoreService;
  turns: TurnFlowService;
  deckPolicies: DeckPoliciesService;
  botRunner: BotRunnerService;
  setup: DameNatureSetupService;
  actions: DameNatureActionService;
  presenter: DameNaturePresenterService;
  bots: DameNatureBotService;
};

export function createDameNatureRuntime(
  overrides: DameNatureRuntimeOverrides = {},
): DameNatureRuntime {
  const random = overrides.random ?? new RandomService();
  const core = overrides.core ?? new GameCoreService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const deckPolicies = overrides.deckPolicies ?? new DeckPoliciesService(random);
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const setup = overrides.setup ?? new DameNatureSetupService(random);
  const actions =
    overrides.actions ?? new DameNatureActionService(core, turns, deckPolicies);
  const presenter = overrides.presenter ?? new DameNaturePresenterService();
  const bots = overrides.bots ?? new DameNatureBotService(botRunner);

  return {
    service: new DameNatureService(setup, actions, presenter, bots),
    random,
    core,
    turns,
    deckPolicies,
    botRunner,
    setup,
    actions,
    presenter,
    bots,
  };
}
