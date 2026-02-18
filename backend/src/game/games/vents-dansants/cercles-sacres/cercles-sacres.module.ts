import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { CerclesSacresService } from './cercles-sacres.service';
import { CerclesSacresSetupService } from './setup/cercles-sacres-setup.service';
import { CerclesSacresActionService } from './actions/cercles-sacres-action.service';
import { CerclesSacresPresenterService } from './presenter/cercles-sacres-presenter.service';
import { CerclesSacresBotService } from './bots/cercles-sacres-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
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
