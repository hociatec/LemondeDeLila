import { GameCoreService } from '../../../application/services/game-core.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { RandomService } from '../../../application/services/random.service';
import { TurnFlowService } from '../../../application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { TurnService } from '../../../application/services/turn.service';
import { ZigEtZagActionService } from './application/services/zig-et-zag-action.service';
import { ZigEtZagBotService } from './application/services/zig-et-zag-bot.service';
import { ZigEtZagPresenterService } from './application/services/zig-et-zag-presenter.service';
import { ZigEtZagSetupService } from './application/services/zig-et-zag-setup.service';
import { ZigEtZagService } from './application/services/zig-et-zag.service';

export function createZigEtZagRuntime(
  overrides: {
    core?: GameCoreService;
    turns?: TurnFlowService;
    random?: RandomService;
  } = {},
): { service: ZigEtZagService } {
  const core = overrides.core ?? new GameCoreService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const random = overrides.random ?? new RandomService();
  const botRunner = new BotRunnerService(new BotStrategyService(random));
  const setup = new ZigEtZagSetupService(random);
  const actions = new ZigEtZagActionService(core, turns, random);
  const presenter = new ZigEtZagPresenterService();
  const bots = new ZigEtZagBotService(botRunner);

  return {
    service: new ZigEtZagService(setup, actions, presenter, bots),
  };
}
