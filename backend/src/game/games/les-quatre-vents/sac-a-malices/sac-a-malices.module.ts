import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { EngineServicesModule } from '../../../infrastructure/module/engine-services.module';
import { SetupFlowModule } from '../../../application/modules/setup-flow.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { SacAMalicesService } from './application/services/sac-a-malices.service';
import { SacAMalicesSetupService } from './application/services/sac-a-malices-setup.service';
import { SacAMalicesActionService } from './application/services/sac-a-malices-action.service';
import { SacAMalicesPresenterService } from './application/services/sac-a-malices-presenter.service';
import { SacAMalicesBotService } from './application/services/sac-a-malices-bot.service';
import { SacAMalicesPropertyService } from './application/services/sac-a-malices-property.service';
import { SacAMalicesEconomyService } from './application/services/sac-a-malices-economy.service';

@Module({
  imports: [
    GameCoreModule,
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
    SacAMalicesPropertyService,
    SacAMalicesEconomyService,
  ],
  exports: [SacAMalicesService],
})
export class SacAMalicesModule {}






