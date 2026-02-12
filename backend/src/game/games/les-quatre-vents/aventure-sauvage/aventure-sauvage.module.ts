import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { BoardModule } from '../../../modules/board/board.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { AventureSauvageService } from './aventure-sauvage.service';
import { AventureSauvageSetupService } from './setup/aventure-sauvage-setup.service';
import { AventureSauvageActionService } from './actions/aventure-sauvage-action.service';
import { AventureSauvagePresenterService } from './presenter/aventure-sauvage-presenter.service';
import { AventureSauvageBotService } from './bots/aventure-sauvage-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    BoardModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    AventureSauvageService,
    AventureSauvageSetupService,
    AventureSauvageActionService,
    AventureSauvagePresenterService,
    AventureSauvageBotService,
  ],
  exports: [AventureSauvageService],
})
export class AventureSauvageModule {}
