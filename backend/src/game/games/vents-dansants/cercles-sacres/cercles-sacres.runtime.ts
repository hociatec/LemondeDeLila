import { GameCoreService } from '../../../core/application/services/game-core.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { DeckPoliciesService } from '../../../deck-policies/application/services/deck-policies.service';
import { RandomService } from '../../../core/application/services/random.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
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
