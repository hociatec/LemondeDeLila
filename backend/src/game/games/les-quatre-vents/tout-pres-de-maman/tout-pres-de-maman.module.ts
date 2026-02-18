import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { ToutPresDeMamanService } from './tout-pres-de-maman.service';
import { ToutPresDeMamanSetupService } from './setup/tout-pres-de-maman-setup.service';
import { ToutPresDeMamanActionService } from './actions/tout-pres-de-maman-action.service';
import { ToutPresDeMamanPresenterService } from './presenter/tout-pres-de-maman-presenter.service';
import { ToutPresDeMamanBotService } from './bots/tout-pres-de-maman-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    ],
  providers: [
    ToutPresDeMamanService,
    ToutPresDeMamanSetupService,
    ToutPresDeMamanActionService,
    ToutPresDeMamanPresenterService,
    ToutPresDeMamanBotService,
  ],
  exports: [ToutPresDeMamanService],
})
export class ToutPresDeMamanModule {}
