import { Module } from '@nestjs/common';
import { VictoryService } from '../application/services/victory.service';
import { GAME_MODULE_OVERVIEW } from '../../core/application/contracts/game-module-overview.contract';

const victoryOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: VictoryService,
};

@Module({
  providers: [VictoryService, victoryOverviewProvider],
  exports: [VictoryService, victoryOverviewProvider],
})
export class VictoryModule {}



