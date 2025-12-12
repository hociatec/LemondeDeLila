import { Module } from '@nestjs/common';
import { BotStrategyService } from './services/bot-strategy.service';
import { BotRunnerService } from './services/bot-runner.service';

@Module({
  providers: [BotStrategyService, BotRunnerService],
  exports: [BotStrategyService, BotRunnerService],
})
export class BotModule {}
