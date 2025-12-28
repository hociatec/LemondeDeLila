import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { GaloponsEnsembleService } from './galopons-ensemble.service';
import { GaloponsSetupService } from './setup/galopons-setup.service';
import { GaloponsActionService } from './actions/galopons-action.service';
import { GaloponsPresenterService } from './presenter/galopons-presenter.service';
import { GaloponsBotService } from './bots/galopons-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    TurnModule,
    BotModule,
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
