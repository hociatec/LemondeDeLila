import { Module } from '@nestjs/common';
import { BotStrategyService } from './services/bot-strategy.service';
import { BotRunnerService } from './services/bot-runner.service';
import { BotSchedulerService } from './services/bot-scheduler.service';

@Module({
  providers: [BotStrategyService, BotRunnerService, BotSchedulerService],
  exports: [BotStrategyService, BotRunnerService, BotSchedulerService],
})
export class BotModule {}
