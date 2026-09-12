import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
    const answers = normalizeAnswers(command.answers);
    const correctIndex = normalizeCorrectIndex(command.correctIndex);
    const categoryId = normalizeCategoryId(command.categoryId);
    const question = normalizeQuestion(command.question);
    const status = this.normalizeStatus(command.status);
    if (!status) throw new BadRequestException('Statut de question invalide.');
    const correct = answers[correctIndex] ?? '';
    const wrong = answers.filter((_, index) => index !== correctIndex);

    this.store.createQuestion({
      categoryId,
      question,
      correct,
      wrong1: wrong[0] ?? '',
      wrong2: wrong[1] ?? '',
      wrong3: wrong[2] ?? '',
      status,
    });
  }

  update(command: UpdateAdminMnemoQuestionCommand) {
    if (
      typeof command.id !== 'string' ||
      !command.id.trim() ||
      command.id.length > 128
    ) {
      throw new BadRequestException('Identifiant de question invalide.');
    }
    const patch: MnemoQuestionPatch = {};
    if (command.categoryId) {
      patch.categoryId = normalizeCategoryId(command.categoryId);
    }

    if (command.question !== undefined) {
      patch.question = normalizeQuestion(command.question);
    }
    if (command.status !== undefined) {
      const status = this.normalizeStatus(command.status);
      if (!status)
        throw new BadRequestException('Statut de question invalide.');
      patch.status = status;
    }

    if (command.answers !== undefined || command.correctIndex !== undefined) {
      const existing = this.requireQuestion(command.id);
      const baseAnswers = command.answers
        ? normalizeAnswers(command.answers)
        : [
            existing.correct,
            existing.wrong1,
            existing.wrong2,
            existing.wrong3,
          ].map((answer) => String(answer ?? '').trim());
      const correctIndex =
        command.correctIndex != null
          ? normalizeCorrectIndex(command.correctIndex)
          : 0;
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
    if (typeof id !== 'string' || !id.trim() || id.length > 128) {
      throw new BadRequestException('Identifiant de question invalide.');
    }
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

const MAX_MNEMO_TEXT_LENGTH = 2_000;
const MAX_MNEMO_CATEGORY_LENGTH = 255;

function normalizeAnswers(value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new BadRequestException('Quatre réponses sont requises.');
  }
  const answers = value.map((answer) =>
    typeof answer === 'string' ? answer.trim() : '',
  );
  if (
    answers.some((answer) => !answer || answer.length > MAX_MNEMO_TEXT_LENGTH)
  ) {
    throw new BadRequestException('Réponse Mnemo invalide.');
  }
  return answers;
}

function normalizeCorrectIndex(value: unknown): number {
  const index = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isSafeInteger(index) || index < 0 || index > 3) {
    throw new BadRequestException('Index de réponse invalide.');
  }
  return index;
}

function normalizeCategoryId(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > MAX_MNEMO_CATEGORY_LENGTH) {
    throw new BadRequestException('Catégorie Mnemo invalide.');
  }
  return normalized;
}

function normalizeQuestion(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > MAX_MNEMO_TEXT_LENGTH) {
    throw new BadRequestException('Question Mnemo invalide.');
  }
  return normalized;
}
