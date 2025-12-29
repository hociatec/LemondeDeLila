import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotStrategyService } from './services/bot-strategy.service';
import { BotRunnerService } from './services/bot-runner.service';
import { BotSchedulerService } from './services/bot-scheduler.service';
import { BotSettingsService } from './services/bot-settings.service';
import { BotSettingsEntity } from './entities/bot-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BotSettingsEntity])],
  providers: [
    BotStrategyService,
    BotRunnerService,
    BotSchedulerService,
    BotSettingsService,
  ],
  exports: [
    BotStrategyService,
    BotRunnerService,
    BotSchedulerService,
    BotSettingsService,
  ],
})
export class BotModule {}
