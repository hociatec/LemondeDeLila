import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BoardModule } from '../../../modules/board/board.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
import { ToutPresDeMamanService } from './tout-pres-de-maman.service';
import { ToutPresDeMamanSetupService } from './setup/tout-pres-de-maman-setup.service';
import { ToutPresDeMamanActionService } from './actions/tout-pres-de-maman-action.service';
import { ToutPresDeMamanPresenterService } from './presenter/tout-pres-de-maman-presenter.service';
import { ToutPresDeMamanBotService } from './bots/tout-pres-de-maman-bot.service';

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
    ToutPresDeMamanService,
    ToutPresDeMamanSetupService,
    ToutPresDeMamanActionService,
    ToutPresDeMamanPresenterService,
    ToutPresDeMamanBotService,
  ],
  exports: [ToutPresDeMamanService],
})
export class ToutPresDeMamanModule {}
