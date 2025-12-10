import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { ExchangeService } from '../services/exchange.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/exchange')
@UseGuards(HttpJwtGuard)
export class ExchangeController {
  constructor(private readonly exchange: ExchangeService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.exchange.getOverview();
  }
}
