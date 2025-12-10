import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { MovementService } from '../services/movement.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/movement')
@UseGuards(HttpJwtGuard)
export class MovementController {
  constructor(private readonly movement: MovementService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.movement.getOverview();
  }
}
