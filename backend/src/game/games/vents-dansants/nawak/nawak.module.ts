import { Module } from '@nestjs/common';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { NawakActionService } from './actions/nawak-action.service';
import { NawakBotService } from './bots/nawak-bot.service';
import { NawakChallengeService } from './data/nawak-challenge.service';
import { NawakPresenterService } from './presenter/nawak-presenter.service';
import { NawakSetupService } from './setup/nawak-setup.service';
import { NawakService } from './nawak.service';

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
    NawakService,
    NawakChallengeService,
    NawakSetupService,
    NawakActionService,
    NawakPresenterService,
    NawakBotService,
  ],
  exports: [NawakService],
})
export class NawakModule {}
