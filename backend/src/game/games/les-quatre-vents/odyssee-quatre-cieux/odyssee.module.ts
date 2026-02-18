import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { OdysseeQuatreCieuxService } from './odyssee.service';
import { OdysseeSetupService } from './setup/odyssee-setup.service';
import { OdysseeActionService } from './actions/odyssee-action.service';
import { OdysseePresenterService } from './presenter/odyssee-presenter.service';
import { OdysseeBotService } from './bots/odyssee-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    BoardGameCoreKitModule,
  ],
  providers: [
    OdysseeQuatreCieuxService,
    OdysseeSetupService,
    OdysseeActionService,
    OdysseePresenterService,
    OdysseeBotService,
  ],
  exports: [OdysseeQuatreCieuxService],
})
export class OdysseeQuatreCieuxModule {}
