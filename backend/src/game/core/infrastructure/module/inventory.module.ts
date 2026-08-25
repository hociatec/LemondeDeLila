import { Module } from '@nestjs/common';
import { InventoryService } from '../../application/services/inventory.service';
import { GAME_MODULE_OVERVIEW } from '../../application/contracts/game-module-overview.contract';

const inventoryOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: InventoryService,
};

@Module({
  providers: [InventoryService, inventoryOverviewProvider],
  exports: [InventoryService, inventoryOverviewProvider],
})
export class InventoryModule {}
