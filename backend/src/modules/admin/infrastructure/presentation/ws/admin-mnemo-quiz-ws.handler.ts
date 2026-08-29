import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../../../../platform/realtime/public-api';
import type { WsSession } from '../../../../../platform/realtime/public-api';
import { PayloadValidationService } from '../../../../../platform/validation/public-api';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { AdminMnemoQuizCategoriesService } from '../../../application/use-cases/admin-mnemo-quiz/admin-mnemo-quiz-categories.service';
import { AdminMnemoQuizPresenterService } from '../../../application/use-cases/admin-mnemo-quiz/admin-mnemo-quiz-presenter.service';
import { AdminMnemoQuizQuestionsService } from '../../../application/use-cases/admin-mnemo-quiz/admin-mnemo-quiz-questions.service';
import {
  AdminMnemoQuizCategoriesListWsDto,
  AdminMnemoQuizCategoryCreateWsDto,
  AdminMnemoQuizCategoryDeleteWsDto,
  AdminMnemoQuizCategoryUpdateWsDto,
  AdminMnemoQuizQuestionCreateWsDto,
  AdminMnemoQuizQuestionDeleteWsDto,
  AdminMnemoQuizQuestionUpdateWsDto,
  AdminMnemoQuizQuestionsListWsDto,
} from './dto/admin-mnemo-quiz.ws.dto';

@Injectable()
export class AdminMnemoQuizWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly categories: AdminMnemoQuizCategoriesService,
    private readonly questions: AdminMnemoQuizQuestionsService,
    private readonly presenter: AdminMnemoQuizPresenterService,
  ) {}

  mnemoCategories(session: WsSession, payload: unknown) {
    requireAdmin(session);
    this.validator.validate(AdminMnemoQuizCategoriesListWsDto, payload ?? {});
    this.categories.list();
    return {
      type: WS_EVENTS.admin.quiz.mnemo.categories,
      payload: this.presenter.buildCategoriesPayload(),
    };
  }

  mnemoCategoryCreate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminMnemoQuizCategoryCreateWsDto,
      payload,
    );
    this.categories.create(dto.name);
    return {
      type: WS_EVENTS.admin.quiz.mnemo.categories,
      payload: this.presenter.buildCategoriesPayload(),
    };
  }

  mnemoCategoryUpdate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminMnemoQuizCategoryUpdateWsDto,
      payload,
    );
    this.categories.update(dto.id, dto.name);
    return {
      type: WS_EVENTS.admin.quiz.mnemo.categories,
      payload: this.presenter.buildCategoriesPayload(),
    };
  }

  mnemoCategoryDelete(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminMnemoQuizCategoryDeleteWsDto,
      payload,
    );
    this.categories.delete(dto.id);
    return {
      type: WS_EVENTS.admin.quiz.mnemo.categories,
      payload: this.presenter.buildCategoriesPayload(),
    };
  }

  mnemoQuestions(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminMnemoQuizQuestionsListWsDto,
      payload ?? {},
    );
    return {
      type: WS_EVENTS.admin.quiz.mnemo.questions,
      payload: this.presenter.buildQuestionsPayload({
        categoryId: dto.categoryId?.trim() || undefined,
        status: this.questions.normalizeStatus(dto.status),
      }),
    };
  }

  mnemoQuestionCreate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminMnemoQuizQuestionCreateWsDto,
      payload,
    );
    this.questions.create({
      categoryId: dto.categoryId,
      question: dto.question,
      answers: dto.answers,
      correctIndex: dto.correctIndex,
      status: this.questions.normalizeStatus(dto.status) ?? 'validated',
    });
    return {
      type: WS_EVENTS.admin.quiz.mnemo.questions,
      payload: this.presenter.buildQuestionsPayload(),
    };
  }

  mnemoQuestionUpdate(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminMnemoQuizQuestionUpdateWsDto,
      payload,
    );
    this.questions.update({
      id: dto.id,
      categoryId: dto.categoryId,
      question: dto.question,
      answers: dto.answers,
      correctIndex: dto.correctIndex,
      status:
        dto.status !== undefined
          ? this.questions.normalizeStatus(dto.status)
          : undefined,
    });
    return {
      type: WS_EVENTS.admin.quiz.mnemo.questions,
      payload: this.presenter.buildQuestionsPayload(),
    };
  }

  mnemoQuestionDelete(session: WsSession, payload: unknown) {
    requireAdmin(session);
    const dto = this.validator.validate(
      AdminMnemoQuizQuestionDeleteWsDto,
      payload,
    );
    this.questions.delete(dto.id);
    return {
      type: WS_EVENTS.admin.quiz.mnemo.questions,
      payload: this.presenter.buildQuestionsPayload(),
    };
  }
}
