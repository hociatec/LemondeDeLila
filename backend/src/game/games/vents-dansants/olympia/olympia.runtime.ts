import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { OlympiaActionService } from './application/services/olympia-action.service';
import { OlympiaBotService } from './application/services/olympia-bot.service';
import { OlympiaPresenterService } from './application/services/olympia-presenter.service';
import { OlympiaService } from './application/services/olympia.service';
import { OlympiaSetupService } from './application/services/olympia-setup.service';

export function createOlympiaRuntime(): { service: OlympiaService } {
  const core = new GameCoreService();
  const random = new RandomService();
  const turns = new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const botRunner = new BotRunnerService(new BotStrategyService());
  const setup = new OlympiaSetupService(random);
  const actions = new OlympiaActionService(core, turns);
  const presenter = new OlympiaPresenterService();
  const bots = new OlympiaBotService(botRunner);

  return {
    service: new OlympiaService(setup, actions, presenter, bots),
  };
}
