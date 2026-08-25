import { Module } from '@nestjs/common';
import { QuizRunnerService } from '../application/services/quiz-runner.service';
import { QuizService } from '../application/services/quiz.service';
import { GAME_MODULE_OVERVIEW } from '../../core/application/contracts/game-module-overview.contract';

const quizOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: QuizService,
};

@Module({
  providers: [QuizService, QuizRunnerService, quizOverviewProvider],
  exports: [QuizService, QuizRunnerService, quizOverviewProvider],
})
export class QuizModule {}



