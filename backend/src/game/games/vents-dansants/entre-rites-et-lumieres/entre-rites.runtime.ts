import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { TurnService } from '../../../application/services/turn.service';
import { EntreRitesActionService } from './application/services/entre-rites-action.service';
import { EntreRitesBotService } from './application/services/entre-rites-bot.service';
import { EntreRitesPresenterService } from './application/services/entre-rites-presenter.service';
import { EntreRitesSetupService } from './application/services/entre-rites-setup.service';
import { EntreRitesService } from './application/services/entre-rites.service';

export function createEntreRitesRuntime(
  overrides: {
    random?: RandomService;
    core?: GameCoreService;
    turns?: TurnFlowService;
    deckPolicies?: DeckPoliciesService;
    botRunner?: BotRunnerService;
  } = {},
): { service: EntreRitesService } {
  const random = overrides.random ?? new RandomService();
  const core = overrides.core ?? new GameCoreService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const deckPolicies = overrides.deckPolicies ?? new DeckPoliciesService(random);
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const setup = new EntreRitesSetupService(random);
  const actions = new EntreRitesActionService(core, turns, deckPolicies);
  const presenter = new EntreRitesPresenterService();
  const bots = new EntreRitesBotService(botRunner);

  return {
    service: new EntreRitesService(setup, actions, presenter, bots),
  };
}
