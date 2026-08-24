import { GameCoreService } from '../../../application/services/game-core.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { TurnService } from '../../../application/services/turn.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { RandomService } from '../../../application/services/random.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { CerclesSacresActionService } from './application/services/cercles-sacres-action.service';
import { CerclesSacresBotService } from './application/services/cercles-sacres-bot.service';
import { CerclesSacresPresenterService } from './application/services/cercles-sacres-presenter.service';
import { CerclesSacresService } from './application/services/cercles-sacres.service';
import { CerclesSacresSetupService } from './application/services/cercles-sacres-setup.service';

export function createCerclesSacresRuntime(): { service: CerclesSacresService } {
  const core = new GameCoreService();
  const random = new RandomService();
  const turns = new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const deckPolicies = new DeckPoliciesService(random);
  const botRunner = new BotRunnerService(new BotStrategyService(random));
  const setup = new CerclesSacresSetupService(random);
  const actions = new CerclesSacresActionService(core, turns, deckPolicies);
  const presenter = new CerclesSacresPresenterService();
  const bots = new CerclesSacresBotService(botRunner, random);

  return {
    service: new CerclesSacresService(setup, actions, presenter, bots),
  };
}
