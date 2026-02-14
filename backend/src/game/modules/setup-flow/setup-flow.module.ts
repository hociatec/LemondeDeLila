import { Module } from '@nestjs/common';
import { SetupFlowService } from './services/setup-flow.service';

@Module({
  providers: [SetupFlowService],
  exports: [SetupFlowService],
})
export class SetupFlowModule {}

