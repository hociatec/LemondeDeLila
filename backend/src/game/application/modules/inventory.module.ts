import { Module } from '@nestjs/common';
import { InventoryService } from '../services/inventory.service';
import { GAME_MODULE_OVERVIEW } from '../../game-module-overview.constants';

const inventoryOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: InventoryService,
};

@Module({
  providers: [InventoryService, inventoryOverviewProvider],
  exports: [InventoryService, inventoryOverviewProvider],
})
export class InventoryModule {}
