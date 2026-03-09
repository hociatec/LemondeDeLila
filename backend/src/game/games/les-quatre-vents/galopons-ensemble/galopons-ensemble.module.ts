import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { GaloponsEnsembleService } from './galopons-ensemble.service';
import { GaloponsSetupService } from './setup/galopons-setup.service';
import { GaloponsActionService } from './actions/galopons-action.service';
import { GaloponsPresenterService } from './presenter/galopons-presenter.service';
import { GaloponsBotService } from './bots/galopons-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    SetupFlowModule,
  ],
  providers: [
    GaloponsEnsembleService,
    GaloponsSetupService,
    GaloponsActionService,
    GaloponsPresenterService,
    GaloponsBotService,
  ],
  exports: [GaloponsEnsembleService],
})
export class GaloponsEnsembleModule {}
