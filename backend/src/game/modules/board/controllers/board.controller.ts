import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { BoardService } from '../services/board.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/board')
@UseGuards(HttpJwtGuard)
export class BoardController {
  constructor(private readonly board: BoardService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.board.getOverview();
  }
}
