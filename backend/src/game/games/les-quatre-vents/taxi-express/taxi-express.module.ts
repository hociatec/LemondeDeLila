import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { TaxiExpressService } from './taxi-express.service';
import { TaxiExpressSetupService } from './setup/taxi-express-setup.service';
import { TaxiExpressActionService } from './actions/taxi-express-action.service';
import { TaxiExpressPresenterService } from './presenter/taxi-express-presenter.service';
import { TaxiExpressBotService } from './bots/taxi-express-bot.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
  ],
  providers: [
    TaxiExpressService,
    TaxiExpressSetupService,
    TaxiExpressActionService,
    TaxiExpressPresenterService,
    TaxiExpressBotService,
  ],
  exports: [TaxiExpressService],
})
export class TaxiExpressModule {}
