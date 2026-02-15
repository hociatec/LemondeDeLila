import { Module } from '@nestjs/common';
import { MovementService } from './services/movement.service';
import { GAME_MODULE_OVERVIEW } from '../game-module-overview.constants';

const movementOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: MovementService,
};

@Module({
  providers: [MovementService, movementOverviewProvider],
  exports: [MovementService, movementOverviewProvider],
})
export class MovementModule {}
