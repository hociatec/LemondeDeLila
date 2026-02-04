import { Module } from '@nestjs/common';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { GameCoreModule } from '../../../core/core.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { DameNatureService } from './dame-nature.service';
import { DameNatureSetupService } from './setup/dame-nature-setup.service';
import { DameNatureActionService } from './actions/dame-nature-action.service';
import { DameNaturePresenterService } from './presenter/dame-nature-presenter.service';
import { DameNatureBotService } from './bots/dame-nature-bot.service';

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
    DameNatureService,
    DameNatureSetupService,
    DameNatureActionService,
    DameNaturePresenterService,
    DameNatureBotService,
  ],
  exports: [DameNatureService],
})
export class DameNatureModule {}
