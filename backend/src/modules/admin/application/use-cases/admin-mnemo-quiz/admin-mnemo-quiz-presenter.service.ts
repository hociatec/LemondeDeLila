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
    offset?: number;
    limit?: number;
  }) {
    const allQuestions = this.store.listQuestions(filter);
    const offset = boundedInteger(filter?.offset, 0, 10_000_000, 0);
    const limit = boundedInteger(filter?.limit, 1, 100, 50);
    const questions = allQuestions
      .slice(offset, offset + limit)
      .map((question) => ({
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
    return { questions, total: allQuestions.length, offset, limit };
  }
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : fallback;
}
