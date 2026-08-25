import { BotRunnerService } from '../../../core/application/services/bot-runner.service';
import { BotStrategyService } from '../../../core/application/services/bot-strategy.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { LaParadeSucreeActionService } from './application/services/la-parade-sucree-action.service';
import { LaParadeSucreeBotService } from './application/services/la-parade-sucree-bot.service';
import { LaParadeSucreePresenterService } from './application/services/la-parade-sucree-presenter.service';
import { LaParadeSucreeSetupService } from './application/services/la-parade-sucree-setup.service';
import { LaParadeSucreeService } from './application/services/la-parade-sucree.service';

export function createLaParadeSucreeRuntime(
  overrides: {
    random?: RandomService;
    core?: GameCoreService;
    turns?: TurnFlowService;
    botRunner?: BotRunnerService;
  } = {},
): { service: LaParadeSucreeService } {
  const random = overrides.random ?? new RandomService();
  const core = overrides.core ?? new GameCoreService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService());
  const setup = new LaParadeSucreeSetupService(random);
  const actions = new LaParadeSucreeActionService(core, turns);
  const presenter = new LaParadeSucreePresenterService();
  const bots = new LaParadeSucreeBotService(botRunner);

  return {
    service: new LaParadeSucreeService(setup, actions, presenter, bots),
  };
}
