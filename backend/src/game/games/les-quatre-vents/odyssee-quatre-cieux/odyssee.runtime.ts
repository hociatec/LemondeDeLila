import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import { OdysseeActionService } from './application/services/odyssee-action.service';
import { OdysseeBotService } from './application/services/odyssee-bot.service';
import { OdysseePresenterService } from './application/services/odyssee-presenter.service';
import { OdysseeQuatreCieuxService } from './application/services/odyssee.service';
import { OdysseeSetupService } from './application/services/odyssee-setup.service';

export function createOdysseeRuntime(): { service: OdysseeQuatreCieuxService } {
  const core = new GameCoreService();
  const random = new RandomService();
  const turns = new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const boardPayload = new BoardPayloadService();
  const botRunner = new BotRunnerService(new BotStrategyService());
  const setup = new OdysseeSetupService();
  const actions = new OdysseeActionService(random, turns, core);
  const presenter = new OdysseePresenterService(boardPayload);
  const bots = new OdysseeBotService(botRunner);

  return {
    service: new OdysseeQuatreCieuxService(setup, actions, presenter, bots),
  };
}
