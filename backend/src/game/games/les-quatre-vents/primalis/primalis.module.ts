import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameCoreKitModule } from '../../../module/board-game-kits.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { PrimalisService } from './application/services/primalis.service';
import { PrimalisSetupService } from './application/services/primalis-setup.service';
import { PrimalisActionService } from './application/services/primalis-action.service';
import { PrimalisPresenterService } from './application/services/primalis-presenter.service';
import { PrimalisBotService } from './application/services/primalis-bot.service';

@Module({
  imports: [
    BoardGameCoreKitModule,
    GameCoreModule,
    EngineServicesModule,
  ],
  providers: [
    PrimalisService,
    PrimalisSetupService,
    PrimalisActionService,
    PrimalisPresenterService,
    PrimalisBotService,
  ],
  exports: [PrimalisService],
})
export class PrimalisModule {}






