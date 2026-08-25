import { Module, forwardRef } from '@nestjs/common';
import { TurnActionsService } from '../../application/services/turn-actions.service';
import { TurnFlowService } from '../../application/services/turn-flow.service';
import { TurnLabelService } from '../../application/services/turn-label.service';
import { TurnManagerService } from '../../application/services/turn-manager.service';
import { TurnService } from '../../application/services/turn.service';
import { TurnStatusService } from '../../application/services/turn-status.service';
import { TurnPoliciesModule } from './turn-policies.module';
import { GAME_MODULE_OVERVIEW } from '../../application/contracts/game-module-overview.contract';

const turnOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: TurnService,
};

@Module({
  imports: [forwardRef(() => TurnPoliciesModule)],
  providers: [
    TurnService,
    TurnActionsService,
    TurnManagerService,
    TurnStatusService,
    TurnLabelService,
    TurnFlowService,
    turnOverviewProvider,
  ],
  exports: [
    TurnService,
    TurnActionsService,
    TurnManagerService,
    TurnStatusService,
    TurnLabelService,
    TurnFlowService,
    turnOverviewProvider,
  ],
})
export class TurnModule {}

