import { Inject } from '@nestjs/common';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../core/application/models/game-action.model';
import { AbstractGameService } from '../../../../../core/application/services/abstract-game.service';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { TurnFlowService } from '../../../../../core/application/services/turn-flow.service';
import { RandomService } from '../../../../../core/application/services/random.service';
import {
  actionShortcut,
  interfaceShortcut,
} from '../../../../../shortcuts/public-api';
import type { GameShortcutsContext } from '../../../../../shortcuts/public-api';
import {
  MNEMO_QUIZ_STORE,
  type MnemoQuizStore,
} from '../ports/mnemo-quiz-store.port';
import { ArcheMnemoStateService } from './arche-mnemo-state.service';
import {
  applyActionsSequentially,
  normalizeActionType,
} from '../../../../../core/application/helpers/action-service.helper';
import type {
  MnemoAdminPage,
  MnemoPrompt,
  MnemoQuestionStatus,
  MnemoQuizConfig,
  MnemoQuizMetadata,
} from '../../model/mnemo-quiz.model';
import { resolvePlayerNameFromState } from '../../../../../core/application/helpers/player-name.helper';
import { stringOrEmpty } from '@common/utils/public-api';
import { applyArcheMnemoAdminAction } from '../../arche-mnemo-admin-action.helper';
import {
  buildArcheActionsForUser,
  buildArchePendingForUser,
  syncArcheBotPending,
} from './arche-mnemo-ui.utils';
import {
  drawNextArcheQuestionOrStay,
  resolveArcheQuizIfReady,
} from './arche-mnemo-quiz.utils';
import {
  exposeArcheStateForUser,
  getArcheBotActions,
} from './arche-mnemo-view.utils';
import { hydrateArcheInitialState } from './arche-mnemo-setup.utils';
import {
  GameActionRejectedError,
  GameActorRequiredError,
  GameConfigurationError,
  GamePayloadValidationError,
  GameTurnViolationError,
} from '../../../../../core/domain/errors/game-domain.errors';

type ActionType =
  | 'draw'
  | 'mnemo_start'
  | 'mnemo_open_admin'
  | 'mnemo_back'
  | 'mnemo_open_all_questions'
  | 'mnemo_open_add_category'
  | 'mnemo_add_category'
  | 'mnemo_open_rename_category'
  | 'mnemo_rename_category'
  | 'mnemo_delete_category'
  | 'mnemo_open_category'
  | 'mnemo_open_add_question'
  | 'mnemo_add_question'
  | 'mnemo_open_questions'
  | 'mnemo_open_question'
  | 'mnemo_set_question_status'
  | 'mnemo_open_edit_question'
  | 'mnemo_edit_question'
  | 'mnemo_open_config'
  | 'mnemo_set_config'
  | 'mnemo_prompt_cancel'
  | 'mnemo_timeout'
  | 'answer_quiz';

const ARCHE_PLAYER_NAME_OPTIONS = {
  collapseWhitespace: true,
  unwrapDoubleQuotes: true,
} as const;

export class ArcheDeMnemosyneService extends AbstractGameService {
  readonly gameType = 'arche-de-mnemosyne';
  readonly category = 'Quiz';
  readonly subcategory = 'VentsInfinis';
  readonly displayName = "L'Arche de Mnémosyne";
  readonly description = 'Quiz à catégories (questions aléatoires).';
  readonly minPlayers = 1;
  readonly maxPlayers = 8;

  constructor(
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    @Inject(MNEMO_QUIZ_STORE)
    private readonly store: MnemoQuizStore,
    private readonly random: RandomService,
    private readonly stateSvc: ArcheMnemoStateService,
  ) {
    super();
  }
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    return hydrateArcheInitialState(
      {
        stateSvc: this.stateSvc,
        appendLog: (state, message) => this.core.appendLog(state, message),
      },
      baseState,
    );
  }

  getAvailableActions(state: GameStateEntity, playerId: number) {
    return this.buildActionsForUser(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    const type = normalizeActionType(action) as ActionType;
    if (!type) {
      throw new GameActionRejectedError('Action invalide');
    }
    const adminActions = new Set<ActionType>([
      'mnemo_open_admin',
      'mnemo_back',
      'mnemo_open_all_questions',
      'mnemo_open_add_category',
      'mnemo_add_category',
      'mnemo_open_rename_category',
      'mnemo_rename_category',
      'mnemo_delete_category',
      'mnemo_open_category',
      'mnemo_open_add_question',
      'mnemo_add_question',
      'mnemo_open_questions',
      'mnemo_open_question',
      'mnemo_set_question_status',
      'mnemo_open_edit_question',
      'mnemo_edit_question',
    ]);
    const meta = this.stateSvc.getMeta(state);
    const actor = this.stateSvc.getActionActorTag(action).trim().toLowerCase();
    const isSystem = actor === 'system';

    if (type === 'mnemo_timeout') {
      if (!isSystem) {
        throw new GameActionRejectedError('Action invalide.');
      }
      return { ...action, type, payload: action.payload ?? {} };
    }

    if (adminActions.has(type)) {
      throw new GameActionRejectedError(
        'Administration désactivée pour ce jeu.',
      );
    }

    if (type === 'mnemo_start') {
      if (
        String(state.phase ?? '')
          .toLowerCase()
          .trim() === 'setup' &&
        meta.prompt
      ) {
        throw new GameConfigurationError('Veuillez terminer la configuration.');
      }
      return { ...action, type, payload: action.payload ?? {} };
    }

    if (type === 'draw') {
      const currentId = state.turn?.currentPlayerId ?? null;
      if (actorId == null) {
        throw new GameActorRequiredError();
      }
      if (currentId != null && actorId !== currentId) {
        throw new GameTurnViolationError();
      }
      if (meta.currentQuestion) {
        throw new GameActionRejectedError(
          'Une question est déjà en cours.',
        );
      }
      return { ...action, type, payload: action.payload ?? {} };
    }

    if (type === 'answer_quiz') {
      if (actorId == null) {
        throw new GameActorRequiredError();
      }
      const players = Array.isArray(state.players) ? state.players : [];
      if (!players.some((p) => p?.id === actorId)) {
        throw new GameActionRejectedError('Joueur invalide.');
      }
      if (!meta.currentQuestion) {
        throw new GameActionRejectedError('Aucune question en cours.');
      }
      const deadline = this.stateSvc.getQuizDeadlineAtMs(meta);
      if (deadline != null && this.nowMs() > deadline) {
        throw new GameActionRejectedError('Trop tard.');
      }
      if (this.stateSvc.getQuizAnswers(meta)[actorId] != null) {
        throw new GameActionRejectedError('Vous avez déjà répondu.');
      }
      const idx = Number(this.stateSvc.asRecord(action.payload).answerIndex);
      if (!Number.isFinite(idx) || idx < 0 || idx >= 4) {
        throw new GamePayloadValidationError('Réponse invalide.');
      }
      return { ...action, type, payload: { answerIndex: idx } };
    }

    // Admin / configuration.
    if (type.startsWith('mnemo_')) {
      if (isSystem) {
        return { ...action, type, payload: action.payload ?? {} };
      }

      if (this.stateSvc.isOwner(state, actorId)) {
        return { ...action, type, payload: action.payload ?? {} };
      }

      // Autoriser le joueur courant à configurer la partie pendant le setup.
      if (type === 'mnemo_open_config') {
        if (this.stateSvc.canConfigure(state, actorId)) {
          return { ...action, type, payload: action.payload ?? {} };
        }
        throw new GameConfigurationError('Configuration refusée.');
      }

      // Les prompts (config) sont visibles uniquement pour leur propriétaire.
      if (type === 'mnemo_set_config' || type === 'mnemo_prompt_cancel') {
        const ownerId = this.stateSvc.getPromptOwnerId(meta);
        if (actorId != null && ownerId != null && actorId === ownerId) {
          return { ...action, type, payload: action.payload ?? {} };
        }
        throw new GameActionRejectedError('Action invalide.');
      }

      throw new GameActionRejectedError('Action réservée à Lila.');
    }

    return { ...action, type, payload: action.payload ?? {} };
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]) {
    const next = applyActionsSequentially(state, actions, (current, action) =>
      this.applyOne(current, action),
    );
    return this.syncBotPending(this.resolveQuizIfReady(next));
  }

  getShortcuts(ctx: GameShortcutsContext<unknown>) {
    const started = Boolean(ctx?.started);
    if (!started) {
      return [];
    }

    // "S" : afficher le score (panneau UI géré côté client).
    return [interfaceShortcut('S', 'score'), actionShortcut('SPACE', 'draw')];
  }

  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    return exposeArcheStateForUser(
      {
        stateSvc: this.stateSvc,
        random: this.random,
        store: this.store,
        buildPendingForUser: (value, currentUserId) =>
          this.buildPendingForUser(value, currentUserId),
        buildActionsForUser: (value, currentUserId) =>
          this.buildActionsForUser(value, currentUserId),
        asRecord: (value) => this.stateSvc.asRecord(value),
      },
      state,
      userId,
    );
  }

  private applyOne(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const type = normalizeActionType(action) as ActionType;
    const payload = this.stateSvc.asRecord(action.payload);
    const meta = this.stateSvc.getMeta(state);

    if (type === 'mnemo_timeout') {
      const q = meta.currentQuestion;
      const deadline = this.stateSvc.getQuizDeadlineAtMs(meta);
      if (!q || deadline == null) {
        const until = this.stateSvc.getInterQuestionUntilMs(meta);
        if (until == null) return state;
        if (this.nowMs() < until) return state;

        const clearedMeta: MnemoQuizMetadata = {
          ...meta,
          interQuestionUntilMs: null,
        };
        return { ...state, metadata: clearedMeta };
      }
      if (this.nowMs() < deadline) return state;

      const players = Array.isArray(state.players) ? state.players : [];
      const playerIds = players
        .map((p) => Number(p?.id))
        .filter((id: number) => Number.isFinite(id));
      const answers = this.stateSvc.getQuizAnswers(meta);
      const timedOutIds = playerIds.filter((id) => answers[id] == null);
      return this.syncBotPending(
        this.resolveQuizIfReady(state, true, timedOutIds),
      );
    }

    if (type === 'mnemo_prompt_cancel') {
      const cleared = {
        ...state,
        metadata: { ...meta, prompt: null, promptOwnerId: null },
      };
      return this.core.appendLog(cleared, 'Configuration fermée.');
    }

    if (type === 'mnemo_open_config') {
      const actorId = this.stateSvc.getActionActorId(action);
      if (!this.stateSvc.canConfigure(state, actorId)) {
        return state;
      }
      const prompt = this.stateSvc.buildConfigPrompt(meta.config);
      return {
        ...state,
        metadata: { ...meta, prompt, promptOwnerId: actorId },
      };
    }

    if (type === 'mnemo_set_config') {
      const actorId = this.stateSvc.getActionActorId(action);
      const ownerId = this.stateSvc.getPromptOwnerId(meta);
      if (actorId == null || ownerId == null || actorId !== ownerId) {
        return state;
      }
      const correctSoloPoints = this.stateSvc.clampInt(
        payload.correctSoloPoints,
        -50,
        50,
        Number(meta.config.correctSoloPoints ?? 2),
      );
      const correctMultiPoints = this.stateSvc.clampInt(
        payload.correctMultiPoints,
        -50,
        50,
        Number(meta.config.correctMultiPoints ?? 1),
      );
      const wrongPoints = this.stateSvc.clampInt(
        payload.wrongPoints,
        -50,
        50,
        Number(meta.config.wrongPoints ?? 0),
      );
      const timeoutPoints = this.stateSvc.clampInt(
        payload.timeoutPoints,
        -50,
        50,
        Number(meta.config.timeoutPoints ?? -1),
      );
      const targetPoints = Math.max(
        1,
        Math.min(200, Number(payload.targetPoints ?? 20)),
      );
      const timerSeconds = Math.max(
        5,
        Math.min(300, Number(payload.timerSeconds ?? 30)),
      );
      const useTimer = this.parseBool(payload.useTimer, false);
      const config: MnemoQuizConfig = {
        targetPoints,
        useTimer,
        timerSeconds,
        interQuestionSeconds: this.stateSvc.clampInt(
          payload.interQuestionSeconds,
          1,
          60,
          Number(meta.config.interQuestionSeconds ?? 15),
        ),
        correctSoloPoints,
        correctMultiPoints,
        wrongPoints,
        timeoutPoints,
      };
      const next = {
        ...state,
        metadata: { ...meta, config, prompt: null, promptOwnerId: null },
      };
      return this.core.appendLog(next, 'Configuration enregistrée.');
    }

    if (type === 'mnemo_start') {
      if (
        String(state.phase ?? '')
          .toLowerCase()
          .trim() !== 'setup'
      ) {
        return state;
      }
      const categoryId =
        typeof payload.categoryId === 'string'
          ? payload.categoryId.trim()
          : null;
      const selected = categoryId && categoryId.length ? categoryId : null;
      const categories = this.store.listCategories();
      const actorId = this.stateSvc.getActionActorId(action);
      const withSelection: MnemoQuizMetadata = {
        ...meta,
        selectedCategoryId: selected,
        adminView: { page: 'setup' },
        prompt: null,
        promptOwnerId: null,
      };
      let started: GameStateEntity = {
        ...state,
        phase: 'play',
        metadata: withSelection,
      };
      if (actorId != null) {
        const label = selected
          ? (categories.find((c) => c.id === selected)?.name ?? selected)
          : 'Mélange (toutes catégories)';
        started = this.core.appendLog(
          started,
          `${resolvePlayerNameFromState(started, actorId, ARCHE_PLAYER_NAME_OPTIONS)} choisit la catégorie : ${label}.`,
        );
      }

      return this.core.appendLog(
        started,
        'Quiz : appuyez sur Espace pour piocher la première question.',
      );
    }

    if (type === 'draw') {
      const actorId = this.stateSvc.getActionActorId(action);
      if (actorId == null) return state;
      const interUntilMs = this.stateSvc.getInterQuestionUntilMs(meta);
      if (interUntilMs != null && this.nowMs() < interUntilMs) return state;
      if (meta.currentQuestion) return state;
      const currentId = state.turn?.currentPlayerId ?? null;
      if (currentId != null && actorId !== currentId) return state;
      if (interUntilMs != null) {
        const clearedMeta: MnemoQuizMetadata = {
          ...meta,
          interQuestionUntilMs: null,
        };
        const clearedState = { ...state, metadata: clearedMeta };
        return this.syncBotPending(this.drawNextQuestionOrStay(clearedState));
      }
      return this.syncBotPending(this.drawNextQuestionOrStay(state));
    }

    // Quiz gameplay: every player can answer (not owner-only).
    // NOTE: The owner-only guard below is for admin pages; quiz answering must remain open to everyone.
    if (type === 'answer_quiz') {
      const actorId = this.stateSvc.getActionActorId(action);
      const question = meta.currentQuestion;
      const answerIndex = Number(payload.answerIndex);
      if (actorId == null || !question) return state;

      const answers = { ...this.stateSvc.getQuizAnswers(meta) };
      if (answers[actorId] != null) return state;

      answers[actorId] = answerIndex;

      // Ne pas annoncer les réponses/état des autres joueurs pendant la question (évite l'effet "triche").
      // Les résultats sont annoncés à la fin (quand tout le monde a répondu / temps écoulé).
      return {
        ...state,
        metadata: { ...meta, quizAnswersByPlayerId: answers },
      };
    }

    if (!this.stateSvc.isOwner(state, this.stateSvc.getActionActorId(action))) {
      // Sécurité: aucune action admin si pas owner.
      return state;
    }

    const adminActionApplied = applyArcheMnemoAdminAction({
      state,
      type,
      payload,
      meta,
      store: this.store,
      back: (view) => this.back(view),
      normalizeStatus: (value) => this.stateSvc.normalizeStatus(value),
      statusLabel: (value) => this.stateSvc.statusLabel(value),
      appendLog: (value, message) => this.core.appendLog(value, message),
    });
    if (adminActionApplied) {
      return adminActionApplied;
    }

    if (type === 'mnemo_open_admin') {
      return {
        ...state,
        metadata: { ...meta, adminView: { page: 'categories' }, prompt: null },
      };
    }

    if (type === 'mnemo_open_all_questions') {
      const raw = stringOrEmpty(payload.status).trim() || 'all';
      const status =
        raw === 'validated' ||
        raw === 'pending' ||
        raw === 'to_edit' ||
        raw === 'trash'
          ? (raw as MnemoQuestionStatus)
          : 'all';
      return {
        ...state,
        metadata: {
          ...meta,
          adminView: { page: 'all_questions', status },
          prompt: null,
        },
      };
    }

    if (type === 'mnemo_back') {
      const back = this.back(meta.adminView);
      return { ...state, metadata: { ...meta, adminView: back, prompt: null } };
    }

    if (type === 'mnemo_open_add_category') {
      const prompt: MnemoPrompt = {
        type: 'text_prompt',
        title: 'Ajouter une catégorie',
        label: 'Nom de catégorie',
        actionType: 'mnemo_add_category',
        payloadKey: 'name',
        cancelActionType: 'mnemo_prompt_cancel',
      };
      return { ...state, metadata: { ...meta, prompt } };
    }

    if (type === 'mnemo_add_category') {
      try {
        this.store.createCategory(stringOrEmpty(payload.name));
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          'Catégorie ajoutée.',
        );
      } catch (err) {
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          `Erreur: ${(err as Error).message}`,
        );
      }
    }

    if (type === 'mnemo_open_rename_category') {
      const categoryId = stringOrEmpty(payload.categoryId).trim();
      const cat = this.store.listCategories().find((c) => c.id === categoryId);
      if (!cat) return state;
      const prompt: MnemoPrompt = {
        type: 'text_prompt',
        title: 'Renommer une catégorie',
        label: 'Nouveau nom',
        actionType: 'mnemo_rename_category',
        payloadKey: 'name',
        initialText: cat.name,
        cancelActionType: 'mnemo_prompt_cancel',
      };
      return {
        ...state,
        metadata: {
          ...meta,
          prompt,
          adminView: { page: 'category', categoryId },
        },
      };
    }

    if (type === 'mnemo_rename_category') {
      const view = meta.adminView;
      if (view.page !== 'category') return state;
      try {
        this.store.renameCategory(view.categoryId, stringOrEmpty(payload.name));
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          'Catégorie renommée.',
        );
      } catch (err) {
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          `Erreur: ${(err as Error).message}`,
        );
      }
    }

    if (type === 'mnemo_delete_category') {
      const categoryId = stringOrEmpty(payload.categoryId).trim();
      try {
        this.store.deleteCategory(categoryId);
        const nextView: MnemoAdminPage = { page: 'categories' };
        return this.core.appendLog(
          {
            ...state,
            metadata: { ...meta, adminView: nextView, prompt: null },
          },
          'Catégorie supprimée (questions mises à la corbeille).',
        );
      } catch (err) {
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          `Erreur: ${(err as Error).message}`,
        );
      }
    }

    if (type === 'mnemo_open_category') {
      const categoryId = stringOrEmpty(payload.categoryId).trim();
      if (!this.store.listCategories().some((c) => c.id === categoryId))
        return state;
      return {
        ...state,
        metadata: {
          ...meta,
          adminView: { page: 'category', categoryId },
          prompt: null,
        },
      };
    }

    if (type === 'mnemo_open_add_question') {
      const categoryId = stringOrEmpty(payload.categoryId).trim();
      const cat = this.store.listCategories().find((c) => c.id === categoryId);
      if (!cat) return state;
      const prompt: MnemoPrompt = {
        type: 'config_prompt',
        title: `Ajouter une question (${cat.name})`,
        actionType: 'mnemo_add_question',
        cancelActionType: 'mnemo_prompt_cancel',
        fields: [
          { key: 'question', label: 'Question', kind: 'text', initialText: '' },
          {
            key: 'correct',
            label: 'Bonne réponse',
            kind: 'text',
            initialText: '',
          },
          {
            key: 'wrong1',
            label: 'Mauvaise réponse 1',
            kind: 'text',
            initialText: '',
          },
          {
            key: 'wrong2',
            label: 'Mauvaise réponse 2',
            kind: 'text',
            initialText: '',
          },
          {
            key: 'wrong3',
            label: 'Mauvaise réponse 3',
            kind: 'text',
            initialText: '',
          },
        ],
      };
      return {
        ...state,
        metadata: {
          ...meta,
          prompt,
          adminView: { page: 'category', categoryId },
        },
      };
    }

    if (type === 'mnemo_add_question') {
      const view = meta.adminView;
      if (view.page !== 'category') return state;
      try {
        this.store.createQuestion({
          categoryId: view.categoryId,
          question: stringOrEmpty(payload.question),
          correct: stringOrEmpty(payload.correct),
          wrong1: stringOrEmpty(payload.wrong1),
          wrong2: stringOrEmpty(payload.wrong2),
          wrong3: stringOrEmpty(payload.wrong3),
          status: 'validated',
        });
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          'Question ajoutée.',
        );
      } catch (err) {
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          `Erreur: ${(err as Error).message}`,
        );
      }
    }

    if (type === 'mnemo_open_questions') {
      const categoryId = stringOrEmpty(payload.categoryId).trim();
      const status = this.stateSvc.normalizeStatus(payload.status);
      return {
        ...state,
        metadata: {
          ...meta,
          adminView: { page: 'questions', categoryId, status },
          prompt: null,
        },
      };
    }

    if (type === 'mnemo_open_question') {
      const questionId = stringOrEmpty(payload.questionId).trim();
      const categoryId = stringOrEmpty(payload.categoryId).trim();
      return {
        ...state,
        metadata: {
          ...meta,
          adminView: { page: 'question', categoryId, questionId },
          prompt: null,
        },
      };
    }

    if (type === 'mnemo_set_question_status') {
      const questionId = stringOrEmpty(payload.questionId).trim();
      const status = this.stateSvc.normalizeStatus(payload.status);
      try {
        this.store.updateQuestion(questionId, { status });
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          `Statut mis à jour (${this.statusLabel(status)}).`,
        );
      } catch (err) {
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          `Erreur: ${(err as Error).message}`,
        );
      }
    }

    if (type === 'mnemo_open_edit_question') {
      const questionId = stringOrEmpty(payload.questionId).trim();
      const q = this.store.listQuestions().find((x) => x.id === questionId);
      if (!q) return state;
      const prompt: MnemoPrompt = {
        type: 'config_prompt',
        title: 'Modifier la question',
        actionType: 'mnemo_edit_question',
        cancelActionType: 'mnemo_prompt_cancel',
        fields: [
          {
            key: 'questionId',
            label: 'Id (ne pas modifier)',
            kind: 'text',
            initialText: q.id,
          },
          {
            key: 'question',
            label: 'Question',
            kind: 'text',
            initialText: q.question,
          },
          {
            key: 'correct',
            label: 'Bonne réponse',
            kind: 'text',
            initialText: q.correct,
          },
          {
            key: 'wrong1',
            label: 'Mauvaise réponse 1',
            kind: 'text',
            initialText: q.wrong1,
          },
          {
            key: 'wrong2',
            label: 'Mauvaise réponse 2',
            kind: 'text',
            initialText: q.wrong2,
          },
          {
            key: 'wrong3',
            label: 'Mauvaise réponse 3',
            kind: 'text',
            initialText: q.wrong3,
          },
        ],
      };
      return { ...state, metadata: { ...meta, prompt } };
    }

    if (type === 'mnemo_edit_question') {
      const questionId = stringOrEmpty(payload.questionId).trim();
      try {
        this.store.updateQuestion(questionId, {
          question: stringOrEmpty(payload.question),
          correct: stringOrEmpty(payload.correct),
          wrong1: stringOrEmpty(payload.wrong1),
          wrong2: stringOrEmpty(payload.wrong2),
          wrong3: stringOrEmpty(payload.wrong3),
        });
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          'Question modifiée.',
        );
      } catch (err) {
        return this.core.appendLog(
          { ...state, metadata: { ...meta, prompt: null } },
          `Erreur: ${(err as Error).message}`,
        );
      }
    }

    return state;
  }

  private resolveQuizIfReady(
    state: GameStateEntity,
    force = false,
    timedOutPlayerIds: number[] = [],
  ): GameStateEntity {
    return resolveArcheQuizIfReady(
      {
        stateSvc: this.stateSvc,
        store: this.store,
        random: this.random,
        turns: this.turns,
        now: () => this.nowMs(),
        appendLog: (value, message) => this.core.appendLog(value, message),
      },
      state,
      force,
      timedOutPlayerIds,
    );
  }

  private drawNextQuestionOrStay(state: GameStateEntity): GameStateEntity {
    return drawNextArcheQuestionOrStay(
      {
        stateSvc: this.stateSvc,
        store: this.store,
        random: this.random,
        turns: this.turns,
        now: () => this.nowMs(),
        appendLog: (value, message) => this.core.appendLog(value, message),
      },
      state,
    );
  }

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null {
    return getArcheBotActions(
      {
        stateSvc: this.stateSvc,
        random: this.random,
        store: this.store,
      },
      state,
      botPlayerId,
    );
  }

  private parseBool(value: unknown, defaultValue = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const t = stringOrEmpty(value).trim().toLowerCase();
    if (!t) return defaultValue;
    if (t === '1' || t === 'true' || t === 'oui' || t === 'yes' || t === 'on')
      return true;
    if (t === '0' || t === 'false' || t === 'non' || t === 'no' || t === 'off')
      return false;
    return defaultValue;
  }

  private syncBotPending(state: GameStateEntity): GameStateEntity {
    return syncArcheBotPending(
      { stateSvc: this.stateSvc, store: this.store, now: () => this.nowMs() },
      state,
    );
  }

  private buildPendingForUser(
    state: GameStateEntity,
    userId: number,
  ): Record<string, unknown> | null {
    return buildArchePendingForUser(
      { stateSvc: this.stateSvc, store: this.store, now: () => this.nowMs() },
      state,
      userId,
    );
  }

  private buildActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    return buildArcheActionsForUser(
      { stateSvc: this.stateSvc, store: this.store, now: () => this.nowMs() },
      state,
      userId,
    );
  }

  private back(view: MnemoAdminPage): MnemoAdminPage {
    if (view.page === 'categories') return { page: 'setup' };
    if (view.page === 'all_questions') return { page: 'categories' };
    if (view.page === 'category') return { page: 'categories' };
    if (view.page === 'questions')
      return { page: 'category', categoryId: view.categoryId };
    if (view.page === 'question')
      return {
        page: 'questions',
        categoryId: view.categoryId,
        status: 'pending',
      };
    return { page: 'setup' };
  }

  private normalizeStatus(value: unknown): MnemoQuestionStatus {
    const raw = stringOrEmpty(value).trim().toLowerCase();
    if (raw === 'validated') return 'validated';
    if (raw === 'to_edit') return 'to_edit';
    if (raw === 'trash') return 'trash';
    return 'pending';
  }

  private statusLabel(value: unknown): string {
    const raw = stringOrEmpty(value).trim().toLowerCase();
    if (raw === 'all') return 'toutes';
    if (raw === 'validated') return 'validée';
    if (raw === 'pending') return 'en attente';
    if (raw === 'to_edit') return 'à modifier';
    if (raw === 'trash') return 'corbeille';
    return stringOrEmpty(value).trim() || raw || 'en attente';
  }
  private isOwner(state: GameStateEntity, playerId: number | null): boolean {
    return this.stateSvc.isOwner(state, playerId);
  }

  private canConfigure(
    state: GameStateEntity,
    actorId: number | null,
  ): boolean {
    return this.stateSvc.canConfigure(state, actorId);
  }

  private getMeta(state: GameStateEntity): MnemoQuizMetadata {
    return this.stateSvc.getMeta(state);
  }

  protected nowMs(): number {
    return Date.now();
  }
}
