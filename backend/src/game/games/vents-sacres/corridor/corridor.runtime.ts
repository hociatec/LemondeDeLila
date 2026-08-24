import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { GameCoreService } from '../../../application/services/game-core.service';
import { GridBlockedEdgesService } from '../../../application/features/grid/services/grid-blocked-edges.service';
import { GridCellActionsService } from '../../../application/features/grid/services/grid-cell-actions.service';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { CorridorActionService } from './application/services/corridor-action.service';
import { CorridorBotService } from './application/services/corridor-bot.service';
import { CorridorPresenterService } from './application/services/corridor-presenter.service';
import { CorridorSetupService } from './application/services/corridor-setup.service';
import { CorridorService } from './application/services/corridor.service';

export function createCorridorRuntime(
  overrides: {
    setupFlow?: SetupFlowService;
    core?: GameCoreService;
    gridBlockedEdges?: GridBlockedEdgesService;
    gridCellActions?: GridCellActionsService;
    botRunner?: BotRunnerService;
  } = {},
): { service: CorridorService } {
  const setupFlow = overrides.setupFlow ?? new SetupFlowService();
  const core = overrides.core ?? new GameCoreService();
  const gridBlockedEdges =
    overrides.gridBlockedEdges ?? new GridBlockedEdgesService();
  const gridCellActions =
    overrides.gridCellActions ?? new GridCellActionsService();
  const random = new RandomService();
  const botRunner =
    overrides.botRunner ?? new BotRunnerService(new BotStrategyService(random));
  const setup = new CorridorSetupService(setupFlow, core);
  const actions = new CorridorActionService(setup, setupFlow);
  const presenter = new CorridorPresenterService(
    gridBlockedEdges,
    gridCellActions,
  );
  const bots = new CorridorBotService(botRunner, random);

  return {
    service: new CorridorService(setup, actions, presenter, bots),
  };
}
