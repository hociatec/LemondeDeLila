import { Module, forwardRef } from '@nestjs/common';
import { TurnActionsService } from '../services/turn-actions.service';
import { TurnFlowService } from '../services/turn-flow.service';
import { TurnLabelService } from '../services/turn-label.service';
import { TurnManagerService } from '../services/turn-manager.service';
import { TurnService } from '../services/turn.service';
import { TurnStatusService } from '../services/turn-status.service';
import { TurnPoliciesModule } from './turn-policies.module';
import { GAME_MODULE_OVERVIEW } from '../../game-module-overview.constants';

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

