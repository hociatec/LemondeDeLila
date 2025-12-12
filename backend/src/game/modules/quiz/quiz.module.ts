import { Module } from '@nestjs/common';
import { QuizService } from './services/quiz.service';
import { QuizRunnerService } from './services/quiz-runner.service';

@Module({
  providers: [QuizService, QuizRunnerService],
  exports: [QuizService, QuizRunnerService],
})
export class QuizModule {}
