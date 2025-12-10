import { Module } from '@nestjs/common';
import { TurnService } from './services/turn.service';
import { TurnActionsService } from './services/turn-actions.service';

@Module({
  providers: [TurnService, TurnActionsService],
  exports: [TurnService, TurnActionsService],
})
export class TurnModule {}
