import { Module } from '@nestjs/common';
import { TurnService } from './services/turn.service';
import { TurnActionsService } from './services/turn-actions.service';
import { TurnManagerService } from './services/turn-manager.service';
import { TurnStatusService } from './services/turn-status.service';
import { TurnLabelService } from './services/turn-label.service';
import { TurnFlowService } from './services/turn-flow.service';

@Module({
  providers: [
    TurnService,
    TurnActionsService,
    TurnManagerService,
    TurnStatusService,
    TurnLabelService,
    TurnFlowService,
  ],
  exports: [
    TurnService,
    TurnActionsService,
    TurnManagerService,
    TurnStatusService,
    TurnLabelService,
    TurnFlowService,
  ],
})
export class TurnModule {}
