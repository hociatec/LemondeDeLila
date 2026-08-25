import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/infrastructure/module/game-core.module';
import { SetupFlowModule } from '../../../core/infrastructure/module/setup-flow.module';
import { BoardGameDeckKitModule } from '../../../composition/board-game-kits.module';
import { TurnPoliciesModule } from '../../../core/infrastructure/module/turn-policies.module';
import { ContesService } from './application/services/contes.service';
import { ContesCacahuetesSetupService } from './application/services/contes-et-cacahuetes-setup.service';
import { ContesActionService } from './application/services/contes-action.service';
import { ContesPresenterService } from './application/services/contes-presenter.service';
import { ContesBotService } from './application/services/contes-bot.service';
import { ContesTargetingService } from './application/services/contes-targeting.service';

@Module({
  imports: [
    GameCoreModule,
    BoardGameDeckKitModule,
    SetupFlowModule,
    TurnPoliciesModule,
  ],
  providers: [
    ContesService,
    ContesCacahuetesSetupService,
    ContesActionService,
    ContesPresenterService,
    ContesBotService,
    ContesTargetingService,
  ],
  exports: [ContesService],
})
export class ContesModule {}





