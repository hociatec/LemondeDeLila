import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { CerclesSacresService } from './cercles-sacres.service';
import { CerclesSacresSetupService } from './setup/cercles-sacres-setup.service';
import { CerclesSacresActionService } from './actions/cercles-sacres-action.service';
import { CerclesSacresPresenterService } from './presenter/cercles-sacres-presenter.service';
import { CerclesSacresBotService } from './bots/cercles-sacres-bot.service';

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
    CerclesSacresService,
    CerclesSacresSetupService,
    CerclesSacresActionService,
    CerclesSacresPresenterService,
    CerclesSacresBotService,
  ],
  exports: [CerclesSacresService],
})
export class CerclesSacresModule {}
