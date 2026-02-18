import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { SacAMalicesService } from './sac-a-malices.service';
import { SacAMalicesSetupService } from './setup/sac-a-malices-setup.service';
import { SacAMalicesActionService } from './actions/sac-a-malices-action.service';
import { SacAMalicesPresenterService } from './presenter/sac-a-malices-presenter.service';
import { SacAMalicesBotService } from './bots/sac-a-malices-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    BoardGameDeckKitModule,
    SetupFlowModule,
  ],
  providers: [
    SacAMalicesService,
    SacAMalicesSetupService,
    SacAMalicesActionService,
    SacAMalicesPresenterService,
    SacAMalicesBotService,
  ],
  exports: [SacAMalicesService],
})
export class SacAMalicesModule {}
