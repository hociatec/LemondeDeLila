import { Module } from '@nestjs/common';
import { PendingActionService } from '../services/pending-action.service';

@Module({
  providers: [PendingActionService],
  exports: [PendingActionService],
})
export class PendingActionModule {}
