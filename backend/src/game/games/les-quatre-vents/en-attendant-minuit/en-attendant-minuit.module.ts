import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { EnAttendantMinuitService } from './en-attendant-minuit.service';
import { MinuitSetupService } from './setup/minuit-setup.service';
import { MinuitActionService } from './actions/minuit-action.service';
import { MinuitPresenterService } from './presenter/minuit-presenter.service';
import { MinuitBotService } from './bots/minuit-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    EnAttendantMinuitService,
    MinuitSetupService,
    MinuitActionService,
    MinuitPresenterService,
    MinuitBotService,
  ],
  exports: [EnAttendantMinuitService],
})
export class EnAttendantMinuitModule {}
