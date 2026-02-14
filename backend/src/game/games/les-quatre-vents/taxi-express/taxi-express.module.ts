import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
import { TaxiExpressService } from './taxi-express.service';
import { TaxiExpressSetupService } from './setup/taxi-express-setup.service';
import { TaxiExpressActionService } from './actions/taxi-express-action.service';
import { TaxiExpressPresenterService } from './presenter/taxi-express-presenter.service';
import { TaxiExpressBotService } from './bots/taxi-express-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    RandomModule,
    DeckPoliciesModule,
    TurnModule,
    BoardModule,
    BotModule,
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
