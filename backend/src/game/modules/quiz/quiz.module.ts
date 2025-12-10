import { Module } from '@nestjs/common';
import { QuizService } from './services/quiz.service';

@Module({
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
