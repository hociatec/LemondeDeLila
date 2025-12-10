import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { CardsService } from '../services/cards.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/cards')
@UseGuards(HttpJwtGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.cards.getOverview();
  }
}
