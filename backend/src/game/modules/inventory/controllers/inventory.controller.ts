import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { InventoryService } from '../services/inventory.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/inventory')
@UseGuards(HttpJwtGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.inventory.getOverview();
  }
}
