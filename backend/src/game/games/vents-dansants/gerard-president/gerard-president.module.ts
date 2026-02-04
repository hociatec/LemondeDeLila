import { Module } from '@nestjs/common';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { GerardPresidentActionService } from './actions/gerard-president-action.service';
import { GerardPresidentBotService } from './bots/gerard-president-bot.service';
import { GerardPresidentPresenterService } from './presenter/gerard-president-presenter.service';
import { GerardPresidentSetupService } from './setup/gerard-president-setup.service';
import { GerardPresidentService } from './gerard-president.service';

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
    GerardPresidentService,
    GerardPresidentSetupService,
    GerardPresidentActionService,
    GerardPresidentPresenterService,
    GerardPresidentBotService,
  ],
  exports: [GerardPresidentService],
})
export class GerardPresidentModule {}
