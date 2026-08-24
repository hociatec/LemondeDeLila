import { Module } from '@nestjs/common';
import { QuizRunnerService } from '../features/quiz/services/quiz-runner.service';
import { QuizService } from '../features/quiz/services/quiz.service';
import { GAME_MODULE_OVERVIEW } from '../../game-module-overview.constants';

const quizOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: QuizService,
};

@Module({
  providers: [QuizService, QuizRunnerService, quizOverviewProvider],
  exports: [QuizService, QuizRunnerService, quizOverviewProvider],
})
export class QuizModule {}



