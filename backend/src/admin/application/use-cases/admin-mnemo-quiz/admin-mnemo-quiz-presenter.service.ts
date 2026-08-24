import { Injectable } from '@nestjs/common';
import { MnemoQuizStoreService } from '../../../../game/games/vents-infinis/arche-de-mnemosyne/public-api';
import type { MnemoQuestionStatus } from '../../../../game/games/vents-infinis/arche-de-mnemosyne/public-api';

@Injectable()
export class AdminMnemoQuizPresenterService {
  constructor(private readonly store: MnemoQuizStoreService) {}

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
