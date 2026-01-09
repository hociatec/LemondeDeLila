import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { PetitChevauxService } from './petit-chevaux.service';
import { PetitChevauxSetupService } from './setup/petit-chevaux-setup.service';
import { PetitChevauxActionService } from './actions/petit-chevaux-action.service';
import { PetitChevauxPhaseService } from './phases/petit-chevaux-phase.service';
import { PetitChevauxPresenterService } from './presenter/petit-chevaux-presenter.service';
import { PetitChevauxBotService } from './bots/petit-chevaux-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    BotModule,
    BoardModule,
    RandomModule,
    TurnModule,
  ],
  providers: [
    PetitChevauxService,
    PetitChevauxSetupService,
    PetitChevauxActionService,
    PetitChevauxPhaseService,
    PetitChevauxPresenterService,
    PetitChevauxBotService,
  ],
  exports: [PetitChevauxService],
})
export class PetitChevauxModule {}
