import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameCoreKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { PrimalisService } from './primalis.service';
import { PrimalisSetupService } from './setup/primalis-setup.service';
import { PrimalisActionService } from './actions/primalis-action.service';
import { PrimalisPresenterService } from './presenter/primalis-presenter.service';
import { PrimalisBotService } from './bots/primalis-bot.service';

@Module({
  imports: [
    BoardGameCoreKitModule,
    GameCoreModule,
    GameRegistryModule,
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
