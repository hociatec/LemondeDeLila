import { Module } from '@nestjs/common';
import { ActionLogService } from '../application/services/action-log.service';

@Module({
  providers: [ActionLogService],
  exports: [ActionLogService],
})
export class ActionLogModule {}



