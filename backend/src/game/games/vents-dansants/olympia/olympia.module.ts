import { Module } from '@nestjs/common';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { GameCoreModule } from '../../../core/core.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { OlympiaService } from './olympia.service';
import { OlympiaSetupService } from './setup/olympia-setup.service';
import { OlympiaActionService } from './actions/olympia-action.service';
import { OlympiaPresenterService } from './presenter/olympia-presenter.service';
import { OlympiaBotService } from './bots/olympia-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    RandomModule,
    BoardModule,
    TurnModule,
    BotModule,
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
