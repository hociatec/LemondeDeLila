import { Controller, Get, UseGuards } from '@nestjs/common';
import { HttpJwtGuard } from '../../../../common/guards/http-jwt.guard';
import { QuizService } from '../services/quiz.service';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Controller('api/games/core/quiz')
@UseGuards(HttpJwtGuard)
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get('overview')
  getOverview(): ModuleOverviewDto {
    return this.quiz.getOverview();
  }
}
