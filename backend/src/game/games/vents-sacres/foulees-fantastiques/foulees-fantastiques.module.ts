import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { EngineServicesModule } from '../../../engine/services/engine-services.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { SetupFlowModule } from '../../../modules/setup-flow/setup-flow.module';
import { FouleesFantastiquesService } from './foulees-fantastiques.service';
import { FouleesFantastiquesSetupService } from './setup/foulees-fantastiques-setup.service';
import { FouleesFantastiquesActionService } from './actions/foulees-fantastiques-action.service';
import { FouleesFantastiquesPhaseService } from './phases/foulees-fantastiques-phase.service';
import { FouleesFantastiquesPresenterService } from './presenter/foulees-fantastiques-presenter.service';
import { FouleesFantastiquesBotService } from './bots/foulees-fantastiques-bot.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    EngineServicesModule,
    BotModule,
    BoardModule,
    RandomModule,
    TurnModule,
    SetupFlowModule,
  ],
  providers: [
    FouleesFantastiquesService,
    FouleesFantastiquesSetupService,
    FouleesFantastiquesActionService,
    FouleesFantastiquesPhaseService,
    FouleesFantastiquesPresenterService,
    FouleesFantastiquesBotService,
  ],
  exports: [FouleesFantastiquesService],
})
export class FouleesFantastiquesModule {}
