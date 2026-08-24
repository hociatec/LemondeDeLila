import { Module } from '@nestjs/common';
import { GameCoreModule } from '../../../module/game-core.module';
import { BoardGameDeckKitModule } from '../../../module/board-game-kits.module';
import { PimpMyRideActionService } from './application/services/pimp-my-ride-action.service';
import { PimpMyRideSetupService } from './application/services/pimp-my-ride-setup.service';
import { PimpMyRidePresenterService } from './application/services/pimp-my-ride-presenter.service';
import { PimpMyRideBotService } from './application/services/pimp-my-ride-bot.service';
import { PimpMyRidePhaseService } from './application/services/pimp-my-ride-phase.service';
import { PimpMyRideService } from './application/services/pimp-my-ride.service';

@Module({
  imports: [GameCoreModule, BoardGameDeckKitModule],
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





