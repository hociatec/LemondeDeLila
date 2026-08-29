import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BOT_SETTINGS_REPOSITORY } from '../../application/contracts/bot-settings.repository';
import { BotRunnerService } from '../../application/services/bot-runner.service';
import { BotSettingsService } from '../../application/services/bot-settings.service';
import { BotSettingsEntity } from '../../infrastructure/persistence/typeorm/entities/bot-settings.entity';
import { BotSettingsTypeormRepository } from '../../infrastructure/persistence/typeorm/repositories/bot-settings-typeorm.repository';

@Module({
  imports: [TypeOrmModule.forFeature([BotSettingsEntity])],
  providers: [
    BotRunnerService,
    BotSettingsService,
    BotSettingsTypeormRepository,
    {
      provide: BOT_SETTINGS_REPOSITORY,
      useExisting: BotSettingsTypeormRepository,
    },
  ],
  exports: [BotRunnerService, BotSettingsService],
})
export class BotModule {}
