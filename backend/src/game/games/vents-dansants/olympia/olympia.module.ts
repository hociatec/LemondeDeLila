import { Module } from '@nestjs/common';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { GameCoreModule } from '../../../core/core.module';
import { OlympiaService } from './olympia.service';
import { OlympiaSetupService } from './setup/olympia-setup.service';
import { OlympiaActionService } from './actions/olympia-action.service';
import { OlympiaPresenterService } from './presenter/olympia-presenter.service';
import { OlympiaBotService } from './bots/olympia-bot.service';

@Module({
  imports: [
    BoardGameCoreKitModule,
    GameCoreModule,
    GameRegistryModule,
    ],
  providers: [
    OlympiaService,
    OlympiaSetupService,
    OlympiaActionService,
    OlympiaPresenterService,
    OlympiaBotService,
  ],
  exports: [OlympiaService],
})
export class OlympiaModule {}
