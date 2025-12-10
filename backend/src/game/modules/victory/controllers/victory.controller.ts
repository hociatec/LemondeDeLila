import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { VictoryService } from '../services/victory.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/victory')
@UseGuards(HttpJwtGuard)
export class VictoryController {
  constructor(private readonly victory: VictoryService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.victory.getOverview();
  }
}
