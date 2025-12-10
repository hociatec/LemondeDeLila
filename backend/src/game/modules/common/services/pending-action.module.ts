import { Module } from '@nestjs/common';
import { PendingActionService } from './pending-action.service';

@Module({
  providers: [PendingActionService],
  exports: [PendingActionService],
})
export class PendingActionModule {}
