import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../engine/dto/game-action.dto';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import { GameCoreService } from '../../../core/services/game-core.service';
import { TurnFlowService } from '../../../modules/turn/services/turn-flow.service';
import { RandomService } from '../../../modules/random/services/random.service';
import { interfaceShortcut } from '../../../engine/shortcuts/shortcut-utils';
import { MnemoQuizStoreService } from './store/mnemo-quiz-store.service';
import type {
  MnemoAdminPage,
  MnemoPrompt,
  MnemoQuestionStatus,
  MnemoQuizConfig,
  MnemoQuizMetadata,
} from './model/mnemo-quiz.model';

type ActionType =
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

@Injectable()
export class ArcheDeMnemosyneService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'arche-de-mnemosyne';
  readonly category = 'Quiz';
  readonly subcategory = 'VentsInfinis';
  readonly displayName = "L'Arche de Mnémosyne";
  readonly description = 'Quiz à catégories (questions aléatoires).';
  readonly minPlayers = 1;
  readonly maxPlayers = 8;

  private readonly logger = new Logger(ArcheDeMnemosyneService.name);

  constructor(
    private readonly registry: GameRegistryService,
    private readonly core: GameCoreService,
    private readonly turns: TurnFlowService,
    private readonly store: MnemoQuizStoreService,
    private readonly random: RandomService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const firstId = players[0]?.id ?? null;
    const baseMeta = (baseState.metadata ?? {}) as any;
    const ownerPlayerId =
      typeof baseMeta.ownerPlayerId === 'number'
        ? baseMeta.ownerPlayerId
        : firstId;

    const config: MnemoQuizConfig = {
      targetPoints: 20,
      useTimer: true,
      timerSeconds: 30,
      correctSoloPoints: 2,
      correctMultiPoints: 1,
      wrongPoints: 0,
      timeoutPoints: -1,
    };

	    const meta: MnemoQuizMetadata = {
	      rng: typeof baseState.metadata === 'object' && baseState.metadata ? (baseState.metadata as any).rng : undefined,
	      ownerPlayerId,
	      config,
      selectedCategoryId: null,
      scoresByPlayerId: Object.fromEntries(
        players.map((p: any) => [p.id, 0]),
      ) as any,
      usedQuestionIds: [],
      currentQuestion: null,
      quizAnswersByPlayerId: {},
	      quizDeadlineAtMs: null,
	      adminView: { page: 'setup' },
	      prompt: this.buildConfigPrompt(config),
	      promptOwnerId: ownerPlayerId,
	      winnerId: null,
	    };

    const state: GameStateEntity = {
      ...baseState,
      status: 'started',
      phase: 'setup',
      round: baseState.round ?? 1,
      turnIndex: baseState.turnIndex ?? 0,
      turn: { currentPlayerId: firstId, direction: 1 },
      pending: null,
      metadata: meta,
      log: Array.isArray(baseState.log) ? baseState.log : [],
    };

    return this.core.appendLog(
      state,
      'Quiz : choisissez une catégorie (ou Mélange) pour démarrer.',
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
    const type = String(action?.type ?? '').trim() as ActionType;
    if (!type) {
      throw new Error('Action invalide');
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
    const meta = this.getMeta(state);
    const actor = String((action as any)?.meta?.actor ?? '').trim().toLowerCase();
    const isSystem = actor === 'system';

    if (type === 'mnemo_timeout') {
      if (!isSystem) {
        throw new Error('Action invalide.');
      }
      return { ...action, type, payload: action.payload ?? {} };
    }

    if (adminActions.has(type)) {
      throw new Error('Administration désactivée pour ce jeu.');
    }

    if (type === 'mnemo_start') {
      if (
        String(state.phase ?? '').toLowerCase().trim() === 'setup' &&
        meta.prompt
      ) {
        throw new Error('Veuillez terminer la configuration.');
      }
      return { ...action, type, payload: action.payload ?? {} };
    }

	    if (type === 'answer_quiz') {
	      if (actorId == null) {
	        throw new Error('Acteur requis.');
	      }
      const players = Array.isArray(state.players) ? state.players : [];
      if (!players.some((p: any) => p?.id === actorId)) {
        throw new Error('Joueur invalide.');
      }
      if (!meta.currentQuestion) {
        throw new Error('Aucune question en cours.');
      }
      const deadline =
        typeof (meta as any).quizDeadlineAtMs === 'number'
          ? (meta as any).quizDeadlineAtMs
          : null;
      if (deadline != null && Date.now() > deadline) {
        throw new Error('Trop tard.');
      }
      if ((meta.quizAnswersByPlayerId as any)?.[actorId] != null) {
        throw new Error('Vous avez déjà répondu.');
      }
      const idx = Number((action.payload as any)?.answerIndex);
      if (!Number.isFinite(idx) || idx < 0 || idx >= 4) {
        throw new Error('Réponse invalide.');
      }
      return { ...action, type, payload: { answerIndex: idx } };
    }

	    // Admin / configuration.
	    if (type.startsWith('mnemo_')) {
	      if (isSystem) {
	        return { ...action, type, payload: action.payload ?? {} };
	      }

      if (this.isOwner(state, actorId)) {
        return { ...action, type, payload: action.payload ?? {} };
      }

      // Autoriser le joueur courant à configurer la partie pendant le setup.
      if (type === 'mnemo_open_config') {
        if (this.canConfigure(state, actorId)) {
          return { ...action, type, payload: action.payload ?? {} };
        }
        throw new Error('Configuration refusée.');
      }

      // Les prompts (config) sont visibles uniquement pour leur propriétaire.
      if (type === 'mnemo_set_config' || type === 'mnemo_prompt_cancel') {
        const ownerId =
          typeof (meta as any).promptOwnerId === 'number'
            ? (meta as any).promptOwnerId
            : null;
        if (actorId != null && ownerId != null && actorId === ownerId) {
          return { ...action, type, payload: action.payload ?? {} };
        }
        throw new Error('Action invalide.');
      }

      throw new Error('Action réservée à Lila.');
    }

    return { ...action, type, payload: action.payload ?? {} };
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]) {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return this.syncBotPending(this.resolveQuizIfReady(next));
  }

  getShortcuts(ctx: any) {
    const started = Boolean(ctx?.started);
    if (!started) {
      return [];
    }

    // "S" : afficher le score (panneau UI géré côté client).
    return [interfaceShortcut('S', 'score')];
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const meta = this.getMeta(state);
    const { quizAnswersByPlayerId: _quizAnswersByPlayerId, ...metaRest } =
      (meta ?? {}) as any;
    const built = this.buildPendingForUser(state, userId);
    const actions = this.buildActionsForUser(state, userId);
    const players = Array.isArray(state.players) ? state.players : [];

    const scoreByPlayerId = (meta?.scoresByPlayerId ?? {}) as any as Record<
      number,
      number
    >;
    const scoreLines = players
      .filter((p: any) => p && Number.isFinite(Number(p.id)))
      .map((p: any) => ({
        id: Number(p.id),
        name: String(p.username ?? `#${p.id}`),
        score: Number(scoreByPlayerId[Number(p.id)] ?? 0),
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));

    const scoreMessage = scoreLines.length
      ? `Score: ${scoreLines.map((s) => `${s.name}: ${s.score}`).join(', ')}`
      : 'Score: indisponible.';

    const safeMeta: any = {
      ...metaRest,
      currentQuestion: meta.currentQuestion
        ? {
            id: meta.currentQuestion.id,
            categoryId: meta.currentQuestion.categoryId,
            question: meta.currentQuestion.question,
            choices: meta.currentQuestion.choices,
          }
        : null,
    };
    if (!this.isOwner(state, userId)) {
      // Ne pas exposer la navigation admin aux joueurs.
      safeMeta.adminView = { page: 'setup' };
      safeMeta.prompt = null;
      safeMeta.promptOwnerId = null;
    }

    return {
      ...(state as any),
      metadata: safeMeta,
      actions: actions.map((a) => ({
        type: a.type,
        label: a.type,
        payload: a.payload ?? {},
      })),
      pending: built,
      extras: {
        ...(((state as any).extras ?? {}) as any),
        ui: {
          ...((((state as any).extras ?? {}) as any)?.ui ?? {}),
          panels: {
            ...((((state as any).extras ?? {}) as any)?.ui?.panels ?? {}),
            score: { title: 'Score', message: scoreMessage },
          },
        },
      },
    } as any;
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const type = String(action?.type ?? '').trim() as ActionType;
    const payload: any = action.payload ?? {};
    const meta = this.getMeta(state);

    if (type === 'mnemo_timeout') {
      const q = meta.currentQuestion;
      const deadline = typeof (meta as any).quizDeadlineAtMs === 'number' ? (meta as any).quizDeadlineAtMs : null;
      if (!q || deadline == null) return state;
      if (Date.now() < deadline) return state;

      const players = Array.isArray(state.players) ? state.players : [];
      const playerIds = players
        .map((p: any) => Number(p?.id))
        .filter((id: number) => Number.isFinite(id));
      const answers = (meta.quizAnswersByPlayerId ?? {}) as any as Record<number, number>;
      const timedOutIds = playerIds.filter((id) => answers[id] == null);
      return this.syncBotPending(this.resolveQuizIfReady(state, true, timedOutIds));
    }

	    if (type === 'mnemo_prompt_cancel') {
	      const cleared = {
	        ...state,
	        metadata: { ...meta, prompt: null, promptOwnerId: null },
	      };
	      return this.core.appendLog(cleared, 'Configuration fermée.');
	    }

	    if (type === 'mnemo_open_config') {
	      const actorId = (action as any)?.meta?.actorId ?? null;
	      if (!this.canConfigure(state, actorId)) {
	        return state;
	      }
	      const prompt = this.buildConfigPrompt(meta.config);
	      return { ...state, metadata: { ...meta, prompt, promptOwnerId: actorId } };
	    }

	    if (type === 'mnemo_set_config') {
	      const actorId = (action as any)?.meta?.actorId ?? null;
	      const ownerId =
	        typeof (meta as any).promptOwnerId === 'number' ? (meta as any).promptOwnerId : null;
	      if (actorId == null || ownerId == null || actorId !== ownerId) {
	        return state;
	      }
	      const correctSoloPoints = this.clampInt(
	        payload.correctSoloPoints,
	        -50,
	        50,
	        Number(meta.config.correctSoloPoints ?? 2),
	      );
	      const correctMultiPoints = this.clampInt(
	        payload.correctMultiPoints,
	        -50,
	        50,
	        Number(meta.config.correctMultiPoints ?? 1),
	      );
	      const wrongPoints = this.clampInt(
	        payload.wrongPoints,
	        -50,
	        50,
	        Number(meta.config.wrongPoints ?? 0),
	      );
	      const timeoutPoints = this.clampInt(
	        payload.timeoutPoints,
	        -50,
	        50,
	        Number(meta.config.timeoutPoints ?? -1),
	      );
	      const targetPoints = Math.max(1, Math.min(200, Number(payload.targetPoints ?? 20)));
	      const timerSeconds = Math.max(5, Math.min(300, Number(payload.timerSeconds ?? 30)));
	      const useTimer = this.parseBool(payload.useTimer, false);
	      const config: MnemoQuizConfig = {
	        targetPoints,
	        useTimer,
	        timerSeconds,
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
      if (String(state.phase ?? '').toLowerCase().trim() !== 'setup') {
        return state;
      }
      const categoryId = typeof payload.categoryId === 'string' ? payload.categoryId.trim() : null;
      const selected = categoryId && categoryId.length ? categoryId : null;
      const withSelection: MnemoQuizMetadata = {
        ...meta,
        selectedCategoryId: selected,
        adminView: { page: 'setup' },
        prompt: null,
        promptOwnerId: null,
      };
      const started = { ...state, phase: 'play', metadata: withSelection };
      return this.syncBotPending(this.drawNextQuestionOrStay(started));
    }

    if (!this.isOwner(state, (action as any)?.meta?.actorId ?? null)) {
      // Sécurité: aucune action admin si pas owner.
      return state;
    }

    if (type === 'mnemo_open_admin') {
      return { ...state, metadata: { ...meta, adminView: { page: 'categories' }, prompt: null } };
    }

    if (type === 'mnemo_open_all_questions') {
      const raw = String(payload.status ?? 'all').trim();
      const status =
        raw === 'validated' || raw === 'pending' || raw === 'to_edit' || raw === 'trash'
          ? (raw as any)
          : 'all';
      return { ...state, metadata: { ...meta, adminView: { page: 'all_questions', status }, prompt: null } };
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
        this.store.createCategory(String(payload.name ?? ''));
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
      const categoryId = String(payload.categoryId ?? '').trim();
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
      return { ...state, metadata: { ...meta, prompt, adminView: { page: 'category', categoryId } } };
    }

    if (type === 'mnemo_rename_category') {
      const view = meta.adminView;
      if (view.page !== 'category') return state;
      try {
        this.store.renameCategory(view.categoryId, String(payload.name ?? ''));
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
      const categoryId = String(payload.categoryId ?? '').trim();
      try {
        this.store.deleteCategory(categoryId);
        const nextView: MnemoAdminPage = { page: 'categories' };
        return this.core.appendLog(
          { ...state, metadata: { ...meta, adminView: nextView, prompt: null } },
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
      const categoryId = String(payload.categoryId ?? '').trim();
      if (!this.store.listCategories().some((c) => c.id === categoryId)) return state;
      return { ...state, metadata: { ...meta, adminView: { page: 'category', categoryId }, prompt: null } };
    }

    if (type === 'mnemo_open_add_question') {
      const categoryId = String(payload.categoryId ?? '').trim();
      const cat = this.store.listCategories().find((c) => c.id === categoryId);
      if (!cat) return state;
      const prompt: MnemoPrompt = {
        type: 'config_prompt',
        title: `Ajouter une question (${cat.name})`,
        actionType: 'mnemo_add_question',
        cancelActionType: 'mnemo_prompt_cancel',
        fields: [
          { key: 'question', label: 'Question', kind: 'text', initialText: '' },
          { key: 'correct', label: 'Bonne réponse', kind: 'text', initialText: '' },
          { key: 'wrong1', label: 'Mauvaise réponse 1', kind: 'text', initialText: '' },
          { key: 'wrong2', label: 'Mauvaise réponse 2', kind: 'text', initialText: '' },
          { key: 'wrong3', label: 'Mauvaise réponse 3', kind: 'text', initialText: '' },
        ],
      };
      return { ...state, metadata: { ...meta, prompt, adminView: { page: 'category', categoryId } } };
    }

    if (type === 'mnemo_add_question') {
      const view = meta.adminView;
      if (view.page !== 'category') return state;
      try {
        this.store.createQuestion({
          categoryId: view.categoryId,
          question: payload.question,
          correct: payload.correct,
          wrong1: payload.wrong1,
          wrong2: payload.wrong2,
          wrong3: payload.wrong3,
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
      const categoryId = String(payload.categoryId ?? '').trim();
      const status = this.normalizeStatus(payload.status);
      return { ...state, metadata: { ...meta, adminView: { page: 'questions', categoryId, status }, prompt: null } };
    }

    if (type === 'mnemo_open_question') {
      const questionId = String(payload.questionId ?? '').trim();
      const categoryId = String(payload.categoryId ?? '').trim();
      return { ...state, metadata: { ...meta, adminView: { page: 'question', categoryId, questionId }, prompt: null } };
    }

    if (type === 'mnemo_set_question_status') {
      const questionId = String(payload.questionId ?? '').trim();
      const status = this.normalizeStatus(payload.status);
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
      const questionId = String(payload.questionId ?? '').trim();
      const q = this.store.listQuestions().find((x) => x.id === questionId);
      if (!q) return state;
      const prompt: MnemoPrompt = {
        type: 'config_prompt',
        title: 'Modifier la question',
        actionType: 'mnemo_edit_question',
        cancelActionType: 'mnemo_prompt_cancel',
        fields: [
          { key: 'questionId', label: 'Id (ne pas modifier)', kind: 'text', initialText: q.id },
          { key: 'question', label: 'Question', kind: 'text', initialText: q.question },
          { key: 'correct', label: 'Bonne réponse', kind: 'text', initialText: q.correct },
          { key: 'wrong1', label: 'Mauvaise réponse 1', kind: 'text', initialText: q.wrong1 },
          { key: 'wrong2', label: 'Mauvaise réponse 2', kind: 'text', initialText: q.wrong2 },
          { key: 'wrong3', label: 'Mauvaise réponse 3', kind: 'text', initialText: q.wrong3 },
        ],
      };
      return { ...state, metadata: { ...meta, prompt } };
    }

    if (type === 'mnemo_edit_question') {
      const questionId = String(payload.questionId ?? '').trim();
      try {
        this.store.updateQuestion(questionId, {
          question: payload.question,
          correct: payload.correct,
          wrong1: payload.wrong1,
          wrong2: payload.wrong2,
          wrong3: payload.wrong3,
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

    if (type === 'answer_quiz') {
      const actorId = (action as any)?.meta?.actorId ?? null;
      const question = meta.currentQuestion;
      const answerIndex = Number(payload.answerIndex);
      if (actorId == null || !question) return state;

      const answers = { ...(meta.quizAnswersByPlayerId ?? {}) } as any;
      if (answers[actorId] != null) return state; // safety (should be blocked by validateAction)

      answers[actorId] = answerIndex;

      const choice = question.choices[answerIndex] ?? '';
      const correct = choice === question.correctChoice;
      const who = this.playerName(state, actorId);
      const withLog = this.core.appendLog(
        state,
        correct
          ? `${who} repond : ${choice}. Bonne reponse.`
          : `${who} repond : ${choice}. Mauvaise reponse.`,
      );

      return { ...withLog, metadata: { ...meta, quizAnswersByPlayerId: answers } };

      /* const currentId = state.turn?.currentPlayerId ?? null;
      const idx = Number(payload.answerIndex);
      const q = meta.currentQuestion;
      if (currentId == null || !q) return state;

      const choice = q.choices[idx] ?? '';
      const correct = choice === q.correctChoice;
      const who = this.playerName(state, currentId);

      let next = state;
      if (correct) {
        const nextScores = { ...(meta.scoresByPlayerId ?? {}) };
        nextScores[currentId] = (nextScores[currentId] ?? 0) + 1;
        next = this.core.appendLog(next, `${who} répond : ${choice}. Bonne réponse (+1).`);
        next = { ...next, metadata: { ...meta, scoresByPlayerId: nextScores } };
      } else {
        next = this.core.appendLog(next, `${who} répond : ${choice}. Mauvaise réponse.`);
      }

      const afterMeta = this.getMeta(next);
      const score = afterMeta.scoresByPlayerId?.[currentId] ?? 0;
      if (score >= (afterMeta.config?.targetPoints ?? 20)) {
        const finished = this.core.appendLog(next, `${who} a gagné !`);
        return {
          ...finished,
          status: 'finished',
          metadata: { ...afterMeta, winnerId: currentId, currentQuestion: null },
        };
      }

      const cleared: GameStateEntity = {
        ...next,
        metadata: {
          ...afterMeta,
          currentQuestion: null,
        },
      };
      const advanced = this.turns.advanceTurn(cleared);
      return this.drawNextQuestionOrStay(advanced);
      */
    }

    return state;
  }

  private resolveQuizIfReady(
    state: GameStateEntity,
    force = false,
    timedOutPlayerIds: number[] = [],
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const q = meta.currentQuestion;
    if (!q) return state;

    const players = Array.isArray(state.players) ? state.players : [];
    const playerIds = players
      .map((p: any) => Number(p?.id))
      .filter((id: number) => Number.isFinite(id));
    if (!playerIds.length) return state;

    const answers = (meta.quizAnswersByPlayerId ?? {}) as any as Record<number, number>;
    const allAnswered = playerIds.every((id) => answers[id] != null);
    if (!force && !allAnswered) {
      return state;
    }

	    const correctIds = playerIds.filter((id) => {
	      const idx = Number(answers[id]);
	      if (!Number.isFinite(idx)) return false;
	      const choice = q.choices[idx] ?? '';
	      return choice === q.correctChoice;
	    });
	    const answeredIds = playerIds.filter((id) => answers[id] != null);
	    const wrongAnsweredIds = answeredIds.filter((id) => !correctIds.includes(id));

	    const correctSoloPoints = this.clampInt(
	      meta.config?.correctSoloPoints,
	      -50,
	      50,
	      2,
	    );
	    const correctMultiPoints = this.clampInt(
	      meta.config?.correctMultiPoints,
	      -50,
	      50,
	      1,
	    );
	    const wrongPoints = this.clampInt(meta.config?.wrongPoints, -50, 50, 0);
	    const timeoutPoints = this.clampInt(meta.config?.timeoutPoints, -50, 50, -1);

	    const nextScores = { ...(meta.scoresByPlayerId ?? {}) } as any as Record<number, number>;
	    let next = state;

	    if (correctIds.length === 0) {
	      next = this.core.appendLog(next, `Personne n'a trouve la bonne reponse (${q.correctChoice}).`);
	    } else if (correctIds.length === 1) {
	      const id = correctIds[0]!;
	      nextScores[id] = (nextScores[id] ?? 0) + correctSoloPoints;
	      const msg =
	        correctSoloPoints === 0
	          ? `${this.playerName(next, id)} ne marque aucun point.`
	          : correctSoloPoints > 0
	            ? `${this.playerName(next, id)} gagne +${correctSoloPoints} points.`
	            : `${this.playerName(next, id)} perd ${Math.abs(correctSoloPoints)} points.`;
	      next = this.core.appendLog(next, msg);
	    } else {
	      for (const id of correctIds) {
	        nextScores[id] = (nextScores[id] ?? 0) + correctMultiPoints;
	      }
	      const labels = correctIds.map((id) => this.playerName(next, id)).join(', ');
	      const msg =
	        correctMultiPoints === 0
	          ? `Plusieurs bonnes reponses (${labels}) : aucun point.`
	          : correctMultiPoints > 0
	            ? `Plusieurs bonnes reponses (${labels}) : +${correctMultiPoints} points chacun.`
	            : `Plusieurs bonnes reponses (${labels}) : -${Math.abs(correctMultiPoints)} points chacun.`;
	      next = this.core.appendLog(next, msg);
	    }

	    if (wrongAnsweredIds.length && wrongPoints !== 0) {
	      for (const id of wrongAnsweredIds) {
	        nextScores[id] = (nextScores[id] ?? 0) + wrongPoints;
	      }
	    }

	    if (force) {
	      const timedOut = (Array.isArray(timedOutPlayerIds) ? timedOutPlayerIds : [])
	        .map((id) => Number(id))
	        .filter((id) => Number.isFinite(id));
	      const unique = [...new Set(timedOut)]
	        .filter((id) => playerIds.includes(id))
	        .filter((id) => answers[id] == null);
	      if (unique.length) {
	        for (const id of unique) {
	          nextScores[id] = (nextScores[id] ?? 0) + timeoutPoints;
	        }
	        const labels = unique.map((id) => this.playerName(next, id)).join(', ');
	        const msg =
	          timeoutPoints === 0
	            ? `Temps ecoule: ${labels} ne marque aucun point.`
	            : timeoutPoints > 0
	              ? `Temps ecoule: ${labels} gagne +${timeoutPoints} points.`
	              : `Temps ecoule: ${labels} perd ${Math.abs(timeoutPoints)} points.`;
	        next = this.core.appendLog(next, msg);
	      }
	    }

    const afterMeta: MnemoQuizMetadata = {
      ...meta,
      scoresByPlayerId: nextScores,
      currentQuestion: null,
      quizAnswersByPlayerId: {},
      quizDeadlineAtMs: null,
    };

    const target = afterMeta.config?.targetPoints ?? 20;
    const reached = playerIds
      .map((id) => ({ id, score: Number(afterMeta.scoresByPlayerId?.[id] ?? 0) }))
      .filter((x) => x.score >= target);

    if (reached.length) {
      reached.sort((a, b) => (b.score - a.score) || (a.id - b.id));
      const winnerId = reached[0]!.id;
      const finished = this.core.appendLog(next, `${this.playerName(next, winnerId)} a gagne !`);
      return {
        ...finished,
        status: 'finished',
        metadata: { ...afterMeta, winnerId },
      };
    }

    const cleared: GameStateEntity = {
      ...next,
      metadata: afterMeta as any,
    };
    const advanced = this.turns.advanceTurn(cleared);
    return this.drawNextQuestionOrStay(advanced);
  }

  private drawNextQuestionOrStay(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const categories = this.store.listCategories();

    const all = this.store
      .listQuestions()
      .filter((q) => String(q.status ?? '') !== 'trash');

    const selected =
      meta.selectedCategoryId &&
      categories.some((c) => c.id === meta.selectedCategoryId)
        ? meta.selectedCategoryId
        : null;

    let pool = all.filter((q) => (selected ? q.categoryId === selected : true));

    if (categories.length === 0) {
      return this.core.appendLog(state, 'Aucune catégorie : utilisez Administration > Ajouter une catégorie.');
    }
    if (all.length === 0) {
      return this.core.appendLog(
        state,
        'Aucune question disponible : utilisez Administration > Ajouter une question.',
      );
    }

    if (pool.length === 0 && selected) {
      // Catégorie sélectionnée mais vide : annuler la sélection pour permettre de jouer quand même.
      return this.drawNextQuestionOrStay({
        ...state,
        metadata: { ...meta, selectedCategoryId: null },
      });
    }

    const used = new Set(meta.usedQuestionIds ?? []);
    const remaining = pool.filter((q) => !used.has(q.id));
    const pickFrom = remaining.length ? remaining : pool;
    const pick = this.random.pickIndex(meta as any, pickFrom.length);
    const picked = pickFrom[pick.index]!;
    let rngMeta = pick.meta as any as MnemoQuizMetadata;

    // Auto-"validate" questions that are played (legacy data may still be pending/to_edit).
    // This ensures the game doesn't get stuck on "validated only" semantics and matches the simplified admin UX.
    try {
      if (picked.status !== 'validated') {
        this.store.updateQuestion(picked.id, { status: 'validated' });
      }
    } catch {
      // ignore (best-effort)
    }
    const rawChoices = [picked.correct, picked.wrong1, picked.wrong2, picked.wrong3].map((s) => String(s ?? '').trim());
    const shuffled = this.random.shuffle(rngMeta as any, rawChoices);
    rngMeta = shuffled.meta as any;
    const choices = shuffled.values;
    const currentQuestion = {
      id: picked.id,
      categoryId: picked.categoryId,
      question: picked.question,
      choices,
      correctChoice: String(picked.correct ?? '').trim(),
    };

    const nextUsed = remaining.length
      ? [...used, picked.id]
      : [picked.id];

    const timerSeconds = Number(rngMeta.config?.timerSeconds ?? 30);
    const useTimer = Boolean(rngMeta.config?.useTimer);
    const quizDeadlineAtMs = useTimer ? Date.now() + Math.max(1, timerSeconds) * 1000 : null;

    return {
      ...state,
      metadata: {
        ...rngMeta,
        usedQuestionIds: nextUsed,
        currentQuestion,
        quizAnswersByPlayerId: {},
        quizDeadlineAtMs,
      },
    };
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] | null {
    const meta = this.getMeta(state);
    const q = meta.currentQuestion;
    if (!q) return null;

    const players = Array.isArray(state.players) ? state.players : [];
    const bot = players.find((p: any) => p?.id === botPlayerId) as any;
    if (!bot?.isBot) return null;

    const answers = (meta.quizAnswersByPlayerId ?? {}) as any as Record<number, number>;
    if (answers[botPlayerId] != null) return null;

    const correctIndex = q.choices.findIndex((c) => c === q.correctChoice);
    const validCorrectIndex =
      correctIndex >= 0 && correctIndex < q.choices.length ? correctIndex : 0;

    // Bot simple: 70% chance de répondre juste, sinon choisit "au hasard" de façon déterministe
    // (évite un état bloqué si useTimer est désactivé).
    const seed = this.hashSeed(`${q.id}:${botPlayerId}`);
    const roll = seed % 10; // 0..9
    const answerIndex =
      roll < 7 ? validCorrectIndex : seed % Math.max(1, q.choices.length);

    return [{ type: 'answer_quiz', payload: { answerIndex } } as any];
  }

  private hashSeed(value: string): number {
    // Hash simple, stable, sans dépendance externe.
    let h = 0;
    const s = String(value ?? '');
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  private parseBool(value: any, defaultValue = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const t = String(value ?? '').trim().toLowerCase();
    if (!t) return defaultValue;
    if (t === '1' || t === 'true' || t === 'oui' || t === 'yes' || t === 'on')
      return true;
    if (t === '0' || t === 'false' || t === 'non' || t === 'no' || t === 'off')
      return false;
    return defaultValue;
  }

  private syncBotPending(state: GameStateEntity): GameStateEntity {
    try {
      if (!state || String(state.status ?? '').toLowerCase().trim() === 'finished') {
        return state;
      }

      const meta = this.getMeta(state);
      if (!meta.currentQuestion) {
        return state.pending ? { ...state, pending: null } : state;
      }

      const answers = (meta.quizAnswersByPlayerId ?? {}) as any as Record<number, number>;
      const players = Array.isArray(state.players) ? state.players : [];
      const bots = players
        .filter((p: any) => p?.isBot)
        .map((p: any) => Number(p?.id))
        .filter((id: number) => Number.isFinite(id))
        .sort((a, b) => a - b);

      const nextBot = bots.find((id) => answers[id] == null) ?? null;
      if (nextBot == null) {
        return state.pending ? { ...state, pending: null } : state;
      }

      return { ...state, pending: { type: 'quiz', playerId: nextBot, blocking: true } as any };
    } catch {
      return state;
    }
  }

  private buildPendingForUser(state: GameStateEntity, userId: number): any {
    const meta = this.getMeta(state);
    const currentId = state.turn?.currentPlayerId ?? null;

    const promptOwnerId =
      typeof (meta as any).promptOwnerId === 'number' ? (meta as any).promptOwnerId : null;
    const canSeePrompt =
      Boolean(meta.prompt) &&
      (promptOwnerId === userId || (promptOwnerId == null && this.isOwner(state, userId)));

    if (canSeePrompt && meta.prompt) {
      const prompt = meta.prompt;
      if (prompt.type === 'text_prompt') {
        return {
          type: 'text_prompt',
          playerId: userId,
          label: prompt.label,
          data: {
            title: prompt.title,
            actionType: prompt.actionType,
            payloadKey: prompt.payloadKey,
            initialText: prompt.initialText ?? '',
            cancelActionType: prompt.cancelActionType ?? 'mnemo_prompt_cancel',
          },
        };
      }
	      if (prompt.type === 'config_prompt') {
	        return {
	          type: 'config_prompt',
	          playerId: userId,
	          label: prompt.title,
	          choices: [],
	          data: {
	            title: prompt.title,
	            actionType: prompt.actionType,
	            cancelActionType: prompt.cancelActionType ?? 'mnemo_prompt_cancel',
	            fields: prompt.fields.map((f) => ({
	              key: f.key,
	              label: f.label,
	              kind: f.kind ?? 'text',
	              initialText: f.initialText ?? '',
	            })),
	          },
	        };
	      }
    }

    if (meta.currentQuestion && (meta.quizAnswersByPlayerId as any)?.[userId] == null) {
      return {
        type: 'quiz',
        playerId: userId,
        question: meta.currentQuestion.question,
        choices: meta.currentQuestion.choices,
        deadlineAtMs: typeof (meta as any).quizDeadlineAtMs === 'number' ? (meta as any).quizDeadlineAtMs : null,
      };
    }

    // Menus (setup/admin) : visibles uniquement à Lila (admin) + au joueur courant pour démarrer.
    const isCurrent = currentId === userId;

    if (meta.adminView.page !== 'setup' && !this.isOwner(state, userId)) {
      return null;
    }

    if (meta.adminView.page === 'setup') {
      if (String(state.phase ?? '').toLowerCase().trim() !== 'setup') {
        return null;
      }
      const categories = this.store.listCategories();
      const choices: string[] = [];
      if (isCurrent) {
        for (const c of categories) {
          choices.push(c.name);
        }
        choices.push('Mélange (toutes catégories)');
      }
      if (choices.length === 0) return null;
      return {
        type: 'mnemo_setup',
        label: "L'Arche de Mnémosyne",
        playerId: userId,
        choices,
      };
    }

    const view = meta.adminView;
    if (view.page === 'categories') {
      const categories = this.store.listCategories();
      const choices = [
        'Voir toutes les questions',
        ...categories.map((c) => `Catégorie: ${c.name}`),
        'Ajouter une catégorie',
        'Retour',
      ];
      return {
        type: 'mnemo_admin',
        label: 'Administration - Catégories',
        playerId: userId,
        choices,
      };
    }
	    if (view.page === 'all_questions') {
	      const categories = this.store.listCategories();
	      const categoryNameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
	      const statusFilter = (view as any).status ?? 'all';
	      const all = this.store.listQuestions();
	      const list =
	        statusFilter === 'all'
	          ? all
	          : all.filter((q) => String(q.status ?? 'pending') === String(statusFilter));

	      const choices = [
	        ...list.map((q) => {
	          const cat = categoryNameById[q.categoryId] ?? q.categoryId;
	          const status = String(q.status ?? 'pending');
	          return `[${this.statusLabel(status)}] ${cat}: ${this.compactQuestionLabel(q.question)}`;
	        }),
	        'Filtrer: toutes',
	        'Filtrer: validées',
	        'Filtrer: en attente',
	        'Filtrer: à modifier',
	        'Filtrer: corbeille',
	        'Retour',
	      ];

	      return {
	        type: 'mnemo_admin',
	        label: `Administration - Questions (${this.statusLabel(statusFilter)})`,
	        playerId: userId,
	        choices,
	      };
	    }
    if (view.page === 'category') {
      const cat = this.store.listCategories().find((c) => c.id === view.categoryId);
      const name = cat?.name ?? view.categoryId;
      return {
        type: 'mnemo_admin',
        label: `Catégorie - ${name}`,
        playerId: userId,
        choices: [
          'Ajouter une question',
          'Lister: Validées',
          'Lister: En attente',
          'Lister: À modifier',
          'Lister: Corbeille',
          'Renommer la catégorie',
          'Supprimer la catégorie',
          'Retour',
        ],
      };
    }
	    if (view.page === 'questions') {
	      const list = this.store.listQuestions({ categoryId: view.categoryId, status: view.status });
	      const choices = [
	        ...list.map((q) => this.compactQuestionLabel(q.question)),
	        'Retour',
	      ];
	      return {
	        type: 'mnemo_admin',
	        label: `Questions - ${this.statusLabel(view.status)}`,
	        playerId: userId,
	        choices,
	      };
	    }
	    if (view.page === 'question') {
	      return {
	        type: 'mnemo_admin',
	        label: 'Question',
	        playerId: userId,
	        choices: [
	          'Passer en: validée',
	          'Passer en: en attente',
	          'Passer en: à modifier',
	          'Passer en: corbeille',
	          'Modifier contenu',
	          'Retour',
	        ],
	      };
	    }

    return null;
  }

  private buildActionsForUser(state: GameStateEntity, userId: number): GameSingleActionDto[] {
    const meta = this.getMeta(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const actions: GameSingleActionDto[] = [];

    const promptOwnerId =
      typeof (meta as any).promptOwnerId === 'number' ? (meta as any).promptOwnerId : null;
    const canSeePrompt =
      Boolean(meta.prompt) &&
      (promptOwnerId === userId || (promptOwnerId == null && this.isOwner(state, userId)));

    if (canSeePrompt && meta.prompt) {
      // Les prompts envoient directement l'actionType; ici on expose juste le cancel pour l’Escape.
      actions.push({ type: 'mnemo_prompt_cancel', payload: {} });
      return actions;
    }

    if (meta.currentQuestion && (meta.quizAnswersByPlayerId as any)?.[userId] == null) {
      for (let i = 0; i < 4; i++) {
        actions.push({ type: 'answer_quiz', payload: { answerIndex: i } });
      }
      return actions;
    }

    const isCurrent = currentId === userId;

    if (meta.adminView.page === 'setup') {
      if (isCurrent) {
        for (const c of this.store.listCategories()) {
          actions.push({ type: 'mnemo_start', payload: { categoryId: c.id } });
        }
        actions.push({ type: 'mnemo_start', payload: { categoryId: null } });
      }
      return actions;
    }

    if (!this.isOwner(state, userId)) {
      return [];
    }

    const view = meta.adminView;
    if (view.page === 'categories') {
      actions.push({ type: 'mnemo_open_all_questions', payload: { status: 'all' } });
      const categories = this.store.listCategories();
      for (const c of categories) {
        actions.push({ type: 'mnemo_open_category', payload: { categoryId: c.id } });
      }
      actions.push({ type: 'mnemo_open_add_category', payload: {} });
      actions.push({ type: 'mnemo_back', payload: {} });
      return actions;
    }

    if (view.page === 'all_questions') {
      const statusFilter = (view as any).status ?? 'all';
      const all = this.store.listQuestions();
      const list =
        statusFilter === 'all'
          ? all
          : all.filter((q) => String(q.status ?? 'pending') === String(statusFilter));

      for (const q of list) {
        actions.push({
          type: 'mnemo_open_question',
          payload: { categoryId: q.categoryId, questionId: q.id },
        });
      }
      actions.push({ type: 'mnemo_open_all_questions', payload: { status: 'all' } });
      actions.push({ type: 'mnemo_open_all_questions', payload: { status: 'validated' } });
      actions.push({ type: 'mnemo_open_all_questions', payload: { status: 'pending' } });
      actions.push({ type: 'mnemo_open_all_questions', payload: { status: 'to_edit' } });
      actions.push({ type: 'mnemo_open_all_questions', payload: { status: 'trash' } });
      actions.push({ type: 'mnemo_back', payload: {} });
      return actions;
    }

    if (view.page === 'category') {
      const categoryId = view.categoryId;
      actions.push({ type: 'mnemo_open_add_question', payload: { categoryId } });
      actions.push({ type: 'mnemo_open_questions', payload: { categoryId, status: 'validated' } });
      actions.push({ type: 'mnemo_open_questions', payload: { categoryId, status: 'pending' } });
      actions.push({ type: 'mnemo_open_questions', payload: { categoryId, status: 'to_edit' } });
      actions.push({ type: 'mnemo_open_questions', payload: { categoryId, status: 'trash' } });
      actions.push({ type: 'mnemo_open_rename_category', payload: { categoryId } });
      actions.push({ type: 'mnemo_delete_category', payload: { categoryId } });
      actions.push({ type: 'mnemo_back', payload: {} });
      return actions;
    }

    if (view.page === 'questions') {
      const list = this.store.listQuestions({ categoryId: view.categoryId, status: view.status });
      for (const q of list) {
        actions.push({
          type: 'mnemo_open_question',
          payload: { categoryId: view.categoryId, questionId: q.id },
        });
      }
      actions.push({ type: 'mnemo_back', payload: {} });
      return actions;
    }

    if (view.page === 'question') {
      const questionId = view.questionId;
      actions.push({ type: 'mnemo_set_question_status', payload: { questionId, status: 'validated' } });
      actions.push({ type: 'mnemo_set_question_status', payload: { questionId, status: 'pending' } });
      actions.push({ type: 'mnemo_set_question_status', payload: { questionId, status: 'to_edit' } });
      actions.push({ type: 'mnemo_set_question_status', payload: { questionId, status: 'trash' } });
      actions.push({ type: 'mnemo_open_edit_question', payload: { questionId } });
      actions.push({ type: 'mnemo_back', payload: {} });
      return actions;
    }

    return actions;
  }

  private back(view: MnemoAdminPage): MnemoAdminPage {
    if (view.page === 'categories') return { page: 'setup' };
    if (view.page === 'all_questions') return { page: 'categories' };
    if (view.page === 'category') return { page: 'categories' };
    if (view.page === 'questions') return { page: 'category', categoryId: view.categoryId };
    if (view.page === 'question') return { page: 'questions', categoryId: view.categoryId, status: 'pending' };
    return { page: 'setup' };
  }

  private normalizeStatus(value: any): MnemoQuestionStatus {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'validated') return 'validated';
    if (raw === 'to_edit') return 'to_edit';
    if (raw === 'trash') return 'trash';
    return 'pending';
  }

  private statusLabel(value: any): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'all') return 'toutes';
    if (raw === 'validated') return 'validée';
    if (raw === 'pending') return 'en attente';
    if (raw === 'to_edit') return 'à modifier';
    if (raw === 'trash') return 'corbeille';
    return String(value ?? '').trim() || raw || 'en attente';
  }

  private buildConfigPrompt(config: MnemoQuizConfig): MnemoPrompt {
    return {
      type: 'config_prompt',
      title: 'Configuration - Arche de Mnémosyne',
	      actionType: 'mnemo_set_config',
	      cancelActionType: 'mnemo_prompt_cancel',
	      fields: [
	        {
	          key: 'correctSoloPoints',
	          label: 'Points : bonne reponse (seul)',
	          kind: 'number',
	          initialText: String((config as any)?.correctSoloPoints ?? 2),
	        },
	        {
	          key: 'correctMultiPoints',
	          label: 'Points : bonne reponse (plusieurs)',
	          kind: 'number',
	          initialText: String((config as any)?.correctMultiPoints ?? 1),
	        },
	        {
	          key: 'wrongPoints',
	          label: 'Points : mauvaise reponse',
	          kind: 'number',
	          initialText: String((config as any)?.wrongPoints ?? 0),
	        },
	        {
	          key: 'timeoutPoints',
	          label: 'Points : temps ecoule / tour passe',
	          kind: 'number',
	          initialText: String((config as any)?.timeoutPoints ?? -1),
	        },
	        {
	          key: 'targetPoints',
	          label: 'Points à atteindre',
	          kind: 'number',
	          initialText: String(config?.targetPoints ?? 20),
	        },
	        {
	          key: 'useTimer',
	          label: 'Chrono (oui/non)',
	          kind: 'boolean',
	          initialText: config?.useTimer ? 'oui' : 'non',
	        },
	        {
	          key: 'timerSeconds',
	          label: 'Secondes (si chrono)',
	          kind: 'number',
	          initialText: String(config?.timerSeconds ?? 30),
	        },
	      ],
	    };
	  }

	  private clampInt(value: any, min: number, max: number, fallback: number): number {
	    const candidate = Number(value);
	    if (!Number.isFinite(candidate)) return this.clampInt(fallback, min, max, 0);
	    const rounded = Math.round(candidate);
	    if (rounded < min) return min;
	    if (rounded > max) return max;
	    return rounded;
	  }

	  private compactQuestionLabel(value: string): string {
	    const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
	    if (trimmed.length <= 80) return trimmed;
	    return trimmed.slice(0, 77) + '...';
	  }

  private isOwner(state: GameStateEntity, playerId: number | null): boolean {
    if (playerId == null) return false;
    const meta = this.getMeta(state) as any;
    const ownerId =
      typeof meta?.ownerPlayerId === 'number' ? meta.ownerPlayerId : null;
    if (ownerId == null) return false;
    return ownerId === playerId;
  }

  private canConfigure(state: GameStateEntity, actorId: number | null): boolean {
    if (actorId == null) return false;
    if (this.isOwner(state, actorId)) return true;

    // Autoriser le joueur courant à configurer la partie pendant le setup.
    if (String(state.phase ?? '').toLowerCase().trim() !== 'setup') return false;
    const currentId = state.turn?.currentPlayerId ?? null;
    return currentId === actorId;
  }

  private playerName(state: GameStateEntity, playerId: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x: any) => x?.id === playerId) as any;
    return String(p?.username ?? '').trim() || `Joueur ${playerId}`;
  }

  private getMeta(state: GameStateEntity): MnemoQuizMetadata {
    return (state.metadata ?? {}) as any;
  }
}
