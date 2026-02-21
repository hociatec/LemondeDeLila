import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { TurnPoliciesModule } from '../../../modules/turn-policies/turn-policies.module';
import { ContesService } from './contes.service';
import { ContesCacahuetesSetupService } from './setup/contes-et-cacahuetes-setup.service';
import { ContesActionService } from './actions/contes-action.service';
import { ContesPresenterService } from './presenter/contes-presenter.service';
import { ContesBotService } from './bots/contes-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
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
  ],
  exports: [ContesService],
})
export class ContesModule {}
