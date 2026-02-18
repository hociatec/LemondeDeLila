import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../core/core.module';
import { GameRegistryModule } from '../../../engine/game-registry.module';
import { BoardGameDeckKitModule } from '../../../modules/game-kits/board-game-kits.module';
import { PimpMyRideActionService } from './actions/pimp-my-ride-action.service';
import { PimpMyRideSetupService } from './setup/pimp-my-ride-setup.service';
import { PimpMyRidePresenterService } from './presenter/pimp-my-ride-presenter.service';
import { PimpMyRideBotService } from './bots/pimp-my-ride-bot.service';
import { PimpMyRidePhaseService } from './phases/pimp-my-ride-phase.service';
import { PimpMyRideService } from './pimp-my-ride.service';

@Module({
  imports: [
    BoardGameDeckKitModule,
    GameCoreModule,
    GameRegistryModule,
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
