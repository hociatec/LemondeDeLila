import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { MnemoQuizStoreService } from '../../game/games/vents-sacres/arche-de-mnemosyne/store/mnemo-quiz-store.service';
import type { MnemoQuestionStatus } from '../../game/games/vents-sacres/arche-de-mnemosyne/model/mnemo-quiz.model';
import {
  AdminMnemoQuizCategoriesListWsDto,
  AdminMnemoQuizCategoryCreateWsDto,
  AdminMnemoQuizCategoryDeleteWsDto,
  AdminMnemoQuizCategoryUpdateWsDto,
  AdminMnemoQuizQuestionCreateWsDto,
  AdminMnemoQuizQuestionDeleteWsDto,
  AdminMnemoQuizQuestionUpdateWsDto,
  AdminMnemoQuizQuestionsListWsDto,
} from './admin-mnemo-quiz.dto';

@Injectable()
export class AdminMnemoQuizWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly store: MnemoQuizStoreService,
  ) {}

  private normalizeStatus(value: any): MnemoQuestionStatus | undefined {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'validated') return 'validated';
    if (raw === 'to_edit') return 'to_edit';
    if (raw === 'trash') return 'trash';
    if (raw === 'pending') return 'pending';
    return undefined;
  }

  private buildCategoriesPayload() {
    const categories = this.store.listCategories().map((c) => ({
      id: c.id,
      name: c.name,
    }));
    return { categories };
  }

  private buildQuestionsPayload(filter?: {
    categoryId?: string;
    status?: MnemoQuestionStatus;
  }) {
    const questions = this.store.listQuestions(filter).map((q) => ({
      id: q.id,
      categoryId: q.categoryId,
      question: q.question,
      status: q.status,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      answers: [q.correct, q.wrong1, q.wrong2, q.wrong3],
      correctIndex: 0,
    }));
    return { questions };
  }

  async mnemoCategories(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminMnemoQuizCategoriesListWsDto, payload ?? {});
    return { type: 'admin.quiz.mnemo.categories', payload: this.buildCategoriesPayload() };
  }

  async mnemoCategoryCreate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminMnemoQuizCategoryCreateWsDto, payload);
    this.store.createCategory(dto.name);
    return { type: 'admin.quiz.mnemo.categories', payload: this.buildCategoriesPayload() };
  }

  async mnemoCategoryUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminMnemoQuizCategoryUpdateWsDto, payload);
    this.store.renameCategory(dto.id, dto.name);
    return { type: 'admin.quiz.mnemo.categories', payload: this.buildCategoriesPayload() };
  }

  async mnemoCategoryDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminMnemoQuizCategoryDeleteWsDto, payload);
    this.store.deleteCategory(dto.id);
    return { type: 'admin.quiz.mnemo.categories', payload: this.buildCategoriesPayload() };
  }

  async mnemoQuestions(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminMnemoQuizQuestionsListWsDto, payload ?? {});
    return {
      type: 'admin.quiz.mnemo.questions',
      payload: this.buildQuestionsPayload({
        categoryId: dto.categoryId?.trim() || undefined,
        status: this.normalizeStatus(dto.status),
      }),
    };
  }

  async mnemoQuestionCreate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminMnemoQuizQuestionCreateWsDto, payload);
    const answers = (dto.answers ?? []).map((a) => String(a ?? '').trim());
    const correctIndex = Number(dto.correctIndex);
    const correct = answers[correctIndex] ?? '';
    const wrong = answers.filter((_, idx) => idx !== correctIndex);
    this.store.createQuestion({
      categoryId: dto.categoryId,
      question: dto.question,
      correct,
      wrong1: wrong[0] ?? '',
      wrong2: wrong[1] ?? '',
      wrong3: wrong[2] ?? '',
      status: this.normalizeStatus(dto.status) ?? 'pending',
    });
    return { type: 'admin.quiz.mnemo.questions', payload: this.buildQuestionsPayload() };
  }

  async mnemoQuestionUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminMnemoQuizQuestionUpdateWsDto, payload);

    if (dto.categoryId) {
      // Catégorie: on fait une update via patch direct sur l'objet (store actuel ne supporte pas le move).
      // On le gère en 2 étapes: lecture + update partielle.
      const existing = this.store.listQuestions().find((q) => q.id === dto.id);
      if (!existing) {
        throw new Error('Question introuvable');
      }
      existing.categoryId = String(dto.categoryId).trim();
      existing.updatedAt = new Date().toISOString();
      // persist via updateQuestion (noop sur champs) pour déclencher validations + persist
      this.store.updateQuestion(dto.id, {});
    }

    const patch: any = {};
    if (dto.question !== undefined) patch.question = dto.question;
    if (dto.status !== undefined) patch.status = this.normalizeStatus(dto.status);

    if (dto.answers !== undefined || dto.correctIndex !== undefined) {
      const existing = this.store.listQuestions().find((q) => q.id === dto.id);
      if (!existing) {
        throw new Error('Question introuvable');
      }
      const baseAnswers = dto.answers
        ? dto.answers.map((a) => String(a ?? '').trim())
        : [existing.correct, existing.wrong1, existing.wrong2, existing.wrong3].map((x) =>
            String(x ?? '').trim(),
          );
      const correctIndex =
        dto.correctIndex != null ? Number(dto.correctIndex) : 0;
      const correct = baseAnswers[correctIndex] ?? '';
      const wrong = baseAnswers.filter((_, idx) => idx !== correctIndex);
      patch.correct = correct;
      patch.wrong1 = wrong[0] ?? '';
      patch.wrong2 = wrong[1] ?? '';
      patch.wrong3 = wrong[2] ?? '';
    }

    this.store.updateQuestion(dto.id, patch);
    return { type: 'admin.quiz.mnemo.questions', payload: this.buildQuestionsPayload() };
  }

  async mnemoQuestionDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminMnemoQuizQuestionDeleteWsDto, payload);
    this.store.deleteQuestion(dto.id);
    return { type: 'admin.quiz.mnemo.questions', payload: this.buildQuestionsPayload() };
  }
}

