import { Module } from '@nestjs/common';
import { ActionLogService } from './services/action-log.service';

@Module({
  providers: [ActionLogService],
  exports: [ActionLogService],
})
export class ActionLogModule {}
