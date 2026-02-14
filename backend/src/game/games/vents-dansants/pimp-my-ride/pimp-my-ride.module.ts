import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { RandomModule } from '../../../modules/random/random.module';
import { TurnModule } from '../../../modules/turn/turn.module';
import { BotModule } from '../../../modules/bot/bot.module';
import { BoardModule } from '../../../modules/board/board.module';
import { DeckPoliciesModule } from '../../../modules/deck-policies/deck-policies.module';
import { PimpMyRideActionService } from './actions/pimp-my-ride-action.service';
import { PimpMyRideSetupService } from './setup/pimp-my-ride-setup.service';
import { PimpMyRidePresenterService } from './presenter/pimp-my-ride-presenter.service';
import { PimpMyRideBotService } from './bots/pimp-my-ride-bot.service';
import { PimpMyRidePhaseService } from './phases/pimp-my-ride-phase.service';
import { PimpMyRideService } from './pimp-my-ride.service';

@Module({
  imports: [
    GameCoreModule,
    GameRegistryModule,
    RandomModule,
    DeckPoliciesModule,
    BoardModule,
    TurnModule,
    BotModule,
  ],
  providers: [
    PimpMyRideService,
    PimpMyRideSetupService,
    PimpMyRideActionService,
    PimpMyRidePresenterService,
    PimpMyRideBotService,
    PimpMyRidePhaseService,
  ],
  exports: [PimpMyRideService],
})
export class PimpMyRideModule {}
