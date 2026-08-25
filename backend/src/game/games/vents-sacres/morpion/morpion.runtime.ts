import { GridCellActionsService } from '../../../grid/application/services/grid-cell-actions.service';
import { GameCoreService } from '../../../core/application/services/game-core.service';
import { SetupFlowService } from '../../../core/application/services/setup-flow.service';
import { MorpionPresenter } from './application/services/morpion.presenter';
import { MorpionService } from './application/services/morpion.service';

export function createMorpionRuntime(
  overrides: {
    gridCellActions?: GridCellActionsService;
    core?: GameCoreService;
    setupFlow?: SetupFlowService;
  } = {},
): { service: MorpionService } {
  const gridCellActions =
    overrides.gridCellActions ?? new GridCellActionsService();
  const core = overrides.core ?? new GameCoreService();
  const setupFlow = overrides.setupFlow ?? new SetupFlowService();
  const presenter = new MorpionPresenter(gridCellActions);

  return {
    service: new MorpionService(presenter, core, setupFlow),
  };
}
