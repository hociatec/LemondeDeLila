import { Module } from '@nestjs/common';
import { VictoryService } from '../features/victory/services/victory.service';
import { GAME_MODULE_OVERVIEW } from '../../game-module-overview.constants';

const victoryOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: VictoryService,
};

@Module({
  providers: [VictoryService, victoryOverviewProvider],
  exports: [VictoryService, victoryOverviewProvider],
})
export class VictoryModule {}



