import { Module } from '@nestjs/common';
import { MovementService } from '../application/services/movement.service';
import { GAME_MODULE_OVERVIEW } from '../../core/application/contracts/game-module-overview.contract';

const movementOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: MovementService,
};

@Module({
  providers: [MovementService, movementOverviewProvider],
  exports: [MovementService, movementOverviewProvider],
})
export class MovementModule {}



