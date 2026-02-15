import { Module } from '@nestjs/common';
import { QuizService } from './services/quiz.service';
import { QuizRunnerService } from './services/quiz-runner.service';
import { GAME_MODULE_OVERVIEW } from '../game-module-overview.constants';

const quizOverviewProvider = {
  provide: GAME_MODULE_OVERVIEW,
  useExisting: QuizService,
};

@Module({
  providers: [QuizService, QuizRunnerService, quizOverviewProvider],
  exports: [QuizService, QuizRunnerService, quizOverviewProvider],
})
export class QuizModule {}
