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
  | 'answer_quiz';

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

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
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const firstId = players[0]?.id ?? null;

    const config: MnemoQuizConfig = {
      targetPoints: 20,
      useTimer: false,
      timerSeconds: 30,
    };

    const meta: MnemoQuizMetadata = {
      config,
      selectedCategoryId: null,
      scoresByPlayerId: Object.fromEntries(
        players.map((p: any) => [p.id, 0]),
      ) as any,
      usedQuestionIds: [],
      currentQuestion: null,
      quizAnswersByPlayerId: {},
      adminView: { page: 'setup' },
      prompt: null,
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
    const meta = this.getMeta(state);

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
      if ((meta.quizAnswersByPlayerId as any)?.[actorId] != null) {
        throw new Error('Vous avez déjà répondu.');
      }
      const idx = Number((action.payload as any)?.answerIndex);
      if (!Number.isFinite(idx) || idx < 0 || idx >= 4) {
        throw new Error('Réponse invalide.');
      }
      return { ...action, type, payload: { answerIndex: idx } };
    }

    // Admin: réservé à Lila.
    if (type.startsWith('mnemo_') && type !== 'mnemo_start') {
      if (!this.isAdmin(state, actorId)) {
        throw new Error('Action réservée à Lila.');
      }
    }

    return { ...action, type, payload: action.payload ?? {} };
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]) {
    let next = state;
    for (const action of actions ?? []) {
      next = this.applyOne(next, action);
    }
    return this.resolveQuizIfReady(next);
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    const meta = this.getMeta(state);
    const { quizAnswersByPlayerId: _quizAnswersByPlayerId, ...metaRest } =
      (meta ?? {}) as any;
    const built = this.buildPendingForUser(state, userId);
    const actions = this.buildActionsForUser(state, userId);

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
    if (!this.isAdmin(state, userId)) {
      // Ne pas exposer la navigation admin aux joueurs.
      safeMeta.adminView = { page: 'setup' };
      safeMeta.prompt = null;
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
    } as any;
  }

  private applyOne(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const type = String(action?.type ?? '').trim() as ActionType;
    const payload: any = action.payload ?? {};
    const meta = this.getMeta(state);

    if (type === 'mnemo_prompt_cancel') {
      return { ...state, metadata: { ...meta, prompt: null } };
    }

    if (type === 'mnemo_open_config') {
      if (!this.isAdmin(state, (action as any)?.meta?.actorId ?? null)) {
        return state;
      }
      const prompt: MnemoPrompt = {
        type: 'config_prompt',
        title: 'Configuration - Arche de Mnémosyne',
        actionType: 'mnemo_set_config',
        cancelActionType: 'mnemo_prompt_cancel',
        fields: [
          { key: 'targetPoints', label: 'Points à atteindre', kind: 'number', initialText: String(meta.config.targetPoints ?? 20) },
          { key: 'useTimer', label: 'Chrono (oui/non)', kind: 'bool', initialText: meta.config.useTimer ? 'oui' : 'non' },
          { key: 'timerSeconds', label: 'Secondes (si chrono)', kind: 'number', initialText: String(meta.config.timerSeconds ?? 30) },
        ],
      };
      return { ...state, metadata: { ...meta, prompt } };
    }

    if (type === 'mnemo_set_config') {
      const targetPoints = Math.max(1, Math.min(200, Number(payload.targetPoints ?? 20)));
      const timerSeconds = Math.max(5, Math.min(300, Number(payload.timerSeconds ?? 30)));
      const useTimer = Boolean(payload.useTimer);
      const config: MnemoQuizConfig = { targetPoints, useTimer, timerSeconds };
      return {
        ...state,
        metadata: { ...meta, config, prompt: null },
      };
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
      };
      const started = { ...state, phase: 'play', metadata: withSelection };
      return this.drawNextQuestionOrStay(started);
    }

    if (!this.isAdmin(state, (action as any)?.meta?.actorId ?? null)) {
      // Sécurité: aucune action admin si pas admin.
      return state;
    }

    if (type === 'mnemo_open_admin') {
      return { ...state, metadata: { ...meta, adminView: { page: 'categories' }, prompt: null } };
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
          `Statut mis à jour (${status}).`,
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

  private resolveQuizIfReady(state: GameStateEntity): GameStateEntity {
    const meta = this.getMeta(state);
    const q = meta.currentQuestion;
    if (!q) return state;

    const players = Array.isArray(state.players) ? state.players : [];
    const playerIds = players
      .map((p: any) => Number(p?.id))
      .filter((id: number) => Number.isFinite(id));
    if (!playerIds.length) return state;

    const answers = (meta.quizAnswersByPlayerId ?? {}) as any as Record<number, number>;
    if (!playerIds.every((id) => answers[id] != null)) {
      return state;
    }

    const correctIds = playerIds.filter((id) => {
      const idx = Number(answers[id]);
      if (!Number.isFinite(idx)) return false;
      const choice = q.choices[idx] ?? '';
      return choice === q.correctChoice;
    });

    const nextScores = { ...(meta.scoresByPlayerId ?? {}) } as any as Record<number, number>;
    let next = state;

    if (correctIds.length === 0) {
      next = this.core.appendLog(next, `Personne n'a trouve la bonne reponse (${q.correctChoice}).`);
    } else if (correctIds.length === 1) {
      const id = correctIds[0]!;
      nextScores[id] = (nextScores[id] ?? 0) + 2;
      next = this.core.appendLog(next, `${this.playerName(next, id)} gagne +2 points.`);
    } else {
      for (const id of correctIds) {
        nextScores[id] = (nextScores[id] ?? 0) + 1;
      }
      const labels = correctIds.map((id) => this.playerName(next, id)).join(', ');
      next = this.core.appendLog(next, `Plusieurs bonnes reponses (${labels}) : +1 point chacun.`);
    }

    const afterMeta: MnemoQuizMetadata = {
      ...meta,
      scoresByPlayerId: nextScores,
      currentQuestion: null,
      quizAnswersByPlayerId: {},
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
    const picked = pickFrom[Math.floor(Math.random() * pickFrom.length)];

    // Auto-"validate" questions that are played (legacy data may still be pending/to_edit).
    // This ensures the game doesn't get stuck on "validated only" semantics and matches the simplified admin UX.
    try {
      if (picked.status !== 'validated') {
        this.store.updateQuestion(picked.id, { status: 'validated' });
      }
    } catch {
      // ignore (best-effort)
    }
    const choices = shuffle([picked.correct, picked.wrong1, picked.wrong2, picked.wrong3].map((s) => String(s ?? '').trim()));
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

    return {
      ...state,
      metadata: {
        ...meta,
        usedQuestionIds: nextUsed,
        currentQuestion,
        quizAnswersByPlayerId: {},
      },
    };
  }

  private buildPendingForUser(state: GameStateEntity, userId: number): any {
    const meta = this.getMeta(state);
    const currentId = state.turn?.currentPlayerId ?? null;

    if (this.isAdmin(state, userId) && meta.prompt) {
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
      };
    }

    // Menus (setup/admin) : visibles uniquement à Lila (admin) + au joueur courant pour démarrer.
    const isCurrent = currentId === userId;

    if (meta.adminView.page !== 'setup' && !this.isAdmin(state, userId)) {
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
      if (this.isAdmin(state, userId)) {
        choices.push('Configurer la partie');
        choices.push('Administration');
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
        label: `Questions - ${view.status}`,
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
          'Passer en: validated',
          'Passer en: pending',
          'Passer en: to_edit',
          'Passer en: trash',
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

    if (this.isAdmin(state, userId) && meta.prompt) {
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
      if (this.isAdmin(state, userId)) {
        actions.push({ type: 'mnemo_open_config', payload: {} });
        actions.push({ type: 'mnemo_open_admin', payload: {} });
      }
      return actions;
    }

    if (!this.isAdmin(state, userId)) {
      return [];
    }

    const view = meta.adminView;
    if (view.page === 'categories') {
      const categories = this.store.listCategories();
      for (const c of categories) {
        actions.push({ type: 'mnemo_open_category', payload: { categoryId: c.id } });
      }
      actions.push({ type: 'mnemo_open_add_category', payload: {} });
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

  private compactQuestionLabel(value: string): string {
    const trimmed = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (trimmed.length <= 80) return trimmed;
    return trimmed.slice(0, 77) + '...';
  }

  private isAdmin(state: GameStateEntity, playerId: number | null): boolean {
    if (playerId == null) return false;
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x: any) => x?.id === playerId) as any;
    const username = String(p?.username ?? '').trim().toLowerCase();
    return username === 'lila';
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
