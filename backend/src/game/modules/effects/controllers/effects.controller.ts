import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { EffectsService } from '../services/effects.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/effects')
@UseGuards(HttpJwtGuard)
export class EffectsController {
  constructor(private readonly effects: EffectsService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.effects.getOverview();
  }
}
