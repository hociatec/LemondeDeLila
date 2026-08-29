import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_MNEMO_QUIZ_STORE_PORT,
  type AdminMnemoQuizStorePort,
} from '../../ports/admin-mnemo-quiz-store.port';
import type {
  MnemoQuestionStatus,
  MnemoQuizQuestion,
} from '../../../domain/models/mnemo-quiz.model';
import type {
  CreateAdminMnemoQuestionCommand,
  ListAdminMnemoQuestionsQuery,
  MnemoQuestionPatch,
  UpdateAdminMnemoQuestionCommand,
} from './admin-mnemo-quiz.types';
import { AdminMnemoQuestionNotFoundError } from '../../../domain/errors/admin-domain.errors';

@Injectable()
export class AdminMnemoQuizQuestionsService {
  constructor(
    @Inject(ADMIN_MNEMO_QUIZ_STORE_PORT)
    private readonly store: AdminMnemoQuizStorePort,
  ) {}

  normalizeStatus(value: unknown): MnemoQuestionStatus | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const raw = value.trim().toLowerCase();
    if (raw === 'validated') return 'validated';
    if (raw === 'to_edit') return 'to_edit';
    if (raw === 'trash') return 'trash';
    if (raw === 'pending') return 'pending';
    return undefined;
  }

  list(query?: ListAdminMnemoQuestionsQuery) {
    return this.store.listQuestions(query);
  }

  create(command: CreateAdminMnemoQuestionCommand) {
    const answers = (command.answers ?? []).map((answer) =>
      String(answer ?? '').trim(),
    );
    const correctIndex = Number(command.correctIndex);
    const correct = answers[correctIndex] ?? '';
    const wrong = answers.filter((_, index) => index !== correctIndex);

    this.store.createQuestion({
      categoryId: command.categoryId,
      question: command.question,
      correct,
      wrong1: wrong[0] ?? '',
      wrong2: wrong[1] ?? '',
      wrong3: wrong[2] ?? '',
      status: command.status ?? 'validated',
    });
  }

  update(command: UpdateAdminMnemoQuestionCommand) {
    if (command.categoryId) {
      this.store.updateQuestion(command.id, {
        categoryId: String(command.categoryId).trim(),
      });
    }

    const patch: MnemoQuestionPatch = {};
    if (command.question !== undefined) {
      patch.question = command.question;
    }
    if (command.status !== undefined) {
      patch.status = command.status;
    }

    if (command.answers !== undefined || command.correctIndex !== undefined) {
      const existing = this.requireQuestion(command.id);
      const baseAnswers = command.answers
        ? command.answers.map((answer) => String(answer ?? '').trim())
        : [
            existing.correct,
            existing.wrong1,
            existing.wrong2,
            existing.wrong3,
          ].map((answer) => String(answer ?? '').trim());
      const correctIndex =
        command.correctIndex != null ? Number(command.correctIndex) : 0;
      const correct = baseAnswers[correctIndex] ?? '';
      const wrong = baseAnswers.filter((_, index) => index !== correctIndex);
      patch.correct = correct;
      patch.wrong1 = wrong[0] ?? '';
      patch.wrong2 = wrong[1] ?? '';
      patch.wrong3 = wrong[2] ?? '';
    }

    this.store.updateQuestion(command.id, patch);
  }

  delete(id: string) {
    this.store.deleteQuestion(id);
  }

  private requireQuestion(id: string): MnemoQuizQuestion {
    const existing = this.store
      .listQuestions()
      .find((question) => question.id === id);
    if (!existing) {
      throw new AdminMnemoQuestionNotFoundError();
    }
    return existing;
  }
}
