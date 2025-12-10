import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { TurnService } from '../services/turn.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/turn')
@UseGuards(HttpJwtGuard)
export class TurnController {
  constructor(private readonly turn: TurnService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.turn.getOverview();
  }
}
