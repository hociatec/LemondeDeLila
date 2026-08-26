import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_MNEMO_QUIZ_STORE_PORT,
  type AdminMnemoQuizStorePort,
} from '../../ports/admin-mnemo-quiz-store.port';
import type { MnemoQuestionStatus } from '../../../domain/models/mnemo-quiz.model';

@Injectable()
export class AdminMnemoQuizPresenterService {
  constructor(
    @Inject(ADMIN_MNEMO_QUIZ_STORE_PORT)
    private readonly store: AdminMnemoQuizStorePort,
  ) {}

  buildCategoriesPayload() {
    const categories = this.store.listCategories().map((category) => ({
      id: category.id,
      name: category.name,
    }));
    return { categories };
  }

  buildQuestionsPayload(filter?: {
    categoryId?: string;
    status?: MnemoQuestionStatus;
  }) {
    const questions = this.store.listQuestions(filter).map((question) => ({
      id: question.id,
      categoryId: question.categoryId,
      question: question.question,
      status: question.status,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      answers: [
        question.correct,
        question.wrong1,
        question.wrong2,
        question.wrong3,
      ],
      correctIndex: 0,
    }));
    return { questions };
  }
}
