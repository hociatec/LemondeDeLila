import { Module } from '@nestjs/common';
import { PendingActionService } from '../../application/services/pending-action.service';

@Module({
  providers: [PendingActionService],
  exports: [PendingActionService],
})
export class PendingActionModule {}
