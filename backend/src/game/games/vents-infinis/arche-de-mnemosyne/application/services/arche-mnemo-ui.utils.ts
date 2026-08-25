import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../../core/application/models/game-action.model';
import type { MnemoQuizStore } from '../ports/mnemo-quiz-store.port';
import type {
  MnemoQuestionStatus,
  MnemoQuizMetadata,
} from '../../model/mnemo-quiz.model';
import type { ArcheMnemoStateService } from './arche-mnemo-state.service';
import { stringOrEmpty } from '@common/utils/public-api';

type ArcheUiDeps = {
  stateSvc: ArcheMnemoStateService;
  store: MnemoQuizStore;
  now: () => number;
};

export function syncArcheBotPending(
  deps: ArcheUiDeps,
  state: GameStateEntity,
): GameStateEntity {
  try {
    if (
      !state ||
      String(state.status ?? '').toLowerCase().trim() === 'finished'
    ) {
      return state;
    }

    const meta = deps.stateSvc.getMeta(state);
    const players = Array.isArray(state.players) ? state.players : [];
    const phase = String(state.phase ?? '').toLowerCase().trim();
    const promptOwnerId = deps.stateSvc.getPromptOwnerId(meta);

    if (phase === 'setup') {
      if (meta.prompt && typeof promptOwnerId === 'number') {
        const promptOwner = players.find((p) => p?.id === promptOwnerId) ?? null;
        if (!state.pending && promptOwner?.isBot) {
          return {
            ...state,
            pending: {
              type: 'mnemo_set_config',
              playerId: promptOwnerId,
              blocking: true,
            },
          };
        }
        return state.pending ? { ...state, pending: null } : state;
      }

      const currentId = state.turn?.currentPlayerId ?? null;
      const currentPlayer = players.find((p) => p?.id === currentId) ?? null;
      if (!state.pending && currentPlayer?.isBot && typeof currentId === 'number') {
        return {
          ...state,
          pending: {
            type: 'mnemo_start',
            playerId: currentId,
            blocking: true,
          },
        };
      }
      return state.pending ? { ...state, pending: null } : state;
    }

    if (!meta.currentQuestion) {
      const currentId = state.turn?.currentPlayerId ?? null;
      const currentPlayer = players.find((p) => p?.id === currentId) ?? null;
      const interUntilMs = deps.stateSvc.getInterQuestionUntilMs(meta);
      if (interUntilMs != null && deps.now() < interUntilMs) {
        return state.pending ? { ...state, pending: null } : state;
      }
      if (!state.pending && currentPlayer?.isBot && typeof currentId === 'number') {
        return {
          ...state,
          pending: {
            type: 'draw',
            playerId: currentId,
            blocking: true,
          },
        };
      }
      return state.pending ? { ...state, pending: null } : state;
    }

    const answers = deps.stateSvc.getQuizAnswers(meta);
    const bots = players
      .filter((p) => p?.isBot)
      .map((p) => Number(p?.id))
      .filter((id: number) => Number.isFinite(id))
      .sort((a, b) => a - b);

    const nextBot = bots.find((id) => answers[id] == null) ?? null;
    if (nextBot == null) {
      return state.pending ? { ...state, pending: null } : state;
    }

    return {
      ...state,
      pending: { type: 'quiz', playerId: nextBot, blocking: true },
    };
  } catch {
    return state;
  }
}

export function buildArchePendingForUser(
  deps: ArcheUiDeps,
  state: GameStateEntity,
  userId: number,
): Record<string, unknown> | null {
  const meta = deps.stateSvc.getMeta(state);
  const currentId = state.turn?.currentPlayerId ?? null;

  const pendingState = state.pending;
  const interUntilMs = deps.stateSvc.getInterQuestionUntilMs(meta);
  if (interUntilMs != null && deps.now() < interUntilMs) {
    return null;
  }

  if (
    !meta.currentQuestion &&
    pendingState?.type === 'draw' &&
    pendingState.playerId === userId
  ) {
    return {
      type: 'draw',
      playerId: userId,
      label: 'Piochez une question (Espace).',
    };
  }

  const promptOwnerId = deps.stateSvc.getPromptOwnerId(meta);
  const canSeePrompt =
    Boolean(meta.prompt) &&
    (promptOwnerId === userId ||
      (promptOwnerId == null && deps.stateSvc.isOwner(state, userId)));

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

  if (meta.currentQuestion && deps.stateSvc.getQuizAnswers(meta)?.[userId] == null) {
    return {
      type: 'quiz',
      label: 'Réponses possibles',
      playerId: userId,
      question: meta.currentQuestion.question,
      choices: meta.currentQuestion.choices,
      deadlineAtMs: deps.stateSvc.getQuizDeadlineAtMs(meta),
    };
  }

  const isCurrent = currentId === userId;
  const isOwner = deps.stateSvc.isOwner(state, userId);

  if (meta.adminView.page !== 'setup' && !deps.stateSvc.isOwner(state, userId)) {
    return null;
  }

  if (meta.adminView.page === 'setup') {
    if (String(state.phase ?? '').toLowerCase().trim() !== 'setup') {
      return null;
    }
    const categories = deps.store.listCategories();
    const choices: string[] = [];
    if (isCurrent || isOwner) {
      for (const category of categories) {
        choices.push(category.name);
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
    const categories = deps.store.listCategories();
    return {
      type: 'mnemo_admin',
      label: 'Administration - Catégories',
      playerId: userId,
      choices: [
        'Voir toutes les questions',
        ...categories.map((category) => `Catégorie: ${category.name}`),
        'Ajouter une catégorie',
        'Retour',
      ],
    };
  }

  if (view.page === 'all_questions') {
    const categories = deps.store.listCategories();
    const categoryNameById = Object.fromEntries(
      categories.map((category) => [category.id, category.name]),
    );
    const statusFilter = view.status ?? 'all';
    const allQuestions = deps.store.listQuestions();
    const filteredQuestions =
      statusFilter === 'all'
        ? allQuestions
        : allQuestions.filter(
            (question) =>
              stringOrEmpty(question.status) === stringOrEmpty(statusFilter),
          );

    return {
      type: 'mnemo_admin',
      label: `Administration - Questions (${deps.stateSvc.statusLabel(statusFilter)})`,
      playerId: userId,
      choices: [
        ...filteredQuestions.map((question) => {
          const category =
            categoryNameById[question.categoryId] ?? question.categoryId;
          const status = stringOrEmpty(question.status);
          return `[${deps.stateSvc.statusLabel(status)}] ${category}: ${deps.stateSvc.compactQuestionLabel(question.question)}`;
        }),
        'Filtrer: toutes',
        'Filtrer: validées',
        'Filtrer: en attente',
        'Filtrer: à modifier',
        'Filtrer: corbeille',
        'Retour',
      ],
    };
  }

  if (view.page === 'category') {
    const category = deps.store
      .listCategories()
      .find((entry) => entry.id === view.categoryId);
    const name = category?.name ?? view.categoryId;
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
    const questions = deps.store.listQuestions({
      categoryId: view.categoryId,
      status: view.status,
    });
    return {
      type: 'mnemo_admin',
      label: `Questions - ${deps.stateSvc.statusLabel(view.status)}`,
      playerId: userId,
      choices: [
        ...questions.map((question) =>
          deps.stateSvc.compactQuestionLabel(question.question),
        ),
        'Retour',
      ],
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

export function buildArcheActionsForUser(
  deps: ArcheUiDeps,
  state: GameStateEntity,
  userId: number,
): GameSingleActionDto[] {
  const meta = deps.stateSvc.getMeta(state);
  const currentId = state.turn?.currentPlayerId ?? null;
  const phase = String(state.phase ?? '').toLowerCase().trim();
  const actions: GameSingleActionDto[] = [];

  const promptOwnerId = deps.stateSvc.getPromptOwnerId(meta);
  const canSeePrompt =
    Boolean(meta.prompt) &&
    (promptOwnerId === userId ||
      (promptOwnerId == null && deps.stateSvc.isOwner(state, userId)));

  if (canSeePrompt && meta.prompt) {
    const promptActionType = String(meta.prompt?.actionType ?? '')
      .trim()
      .toLowerCase();
    if (promptActionType) {
      actions.push({ type: promptActionType, payload: {} });
    }
    const cancelType = String(
      meta.prompt?.cancelActionType ?? 'mnemo_prompt_cancel',
    )
      .trim()
      .toLowerCase();
    actions.push({ type: cancelType || 'mnemo_prompt_cancel', payload: {} });
    return actions;
  }

  if (meta.currentQuestion && deps.stateSvc.getQuizAnswers(meta)?.[userId] == null) {
    for (let i = 0; i < 4; i += 1) {
      actions.push({ type: 'answer_quiz', payload: { answerIndex: i } });
    }
    return actions;
  }

  const isCurrent = currentId === userId;
  const isOwner = deps.stateSvc.isOwner(state, userId);

  if (phase === 'setup') {
    if (meta.prompt) {
      return [];
    }
    if (isCurrent || isOwner) {
      for (const category of deps.store.listCategories()) {
        actions.push({
          type: 'mnemo_start',
          payload: { categoryId: category.id },
        });
      }
      actions.push({ type: 'mnemo_start', payload: { categoryId: null } });
    }
    return actions;
  }

  if (!meta.currentQuestion && isCurrent) {
    actions.push({ type: 'draw', payload: {} });
    return actions;
  }

  if (!deps.stateSvc.isOwner(state, userId)) {
    return [];
  }

  const view = meta.adminView;
  if (view.page === 'categories') {
    actions.push({ type: 'mnemo_open_all_questions', payload: { status: 'all' } });
    for (const category of deps.store.listCategories()) {
      actions.push({
        type: 'mnemo_open_category',
        payload: { categoryId: category.id },
      });
    }
    actions.push({ type: 'mnemo_open_add_category', payload: {} });
    actions.push({ type: 'mnemo_back', payload: {} });
    return actions;
  }

  if (view.page === 'all_questions') {
    const statusFilter = view.status ?? 'all';
    const allQuestions = deps.store.listQuestions();
    const filteredQuestions =
      statusFilter === 'all'
        ? allQuestions
        : allQuestions.filter(
            (question) =>
              stringOrEmpty(question.status) === stringOrEmpty(statusFilter),
          );

    for (const question of filteredQuestions) {
      actions.push({
        type: 'mnemo_open_question',
        payload: { categoryId: question.categoryId, questionId: question.id },
      });
    }
    for (const status of [
      'all',
      'validated',
      'pending',
      'to_edit',
      'trash',
    ] satisfies Array<MnemoQuestionStatus | 'all'>) {
      actions.push({
        type: 'mnemo_open_all_questions',
        payload: { status },
      });
    }
    actions.push({ type: 'mnemo_back', payload: {} });
    return actions;
  }

  if (view.page === 'category') {
    const categoryId = view.categoryId;
    actions.push({ type: 'mnemo_open_add_question', payload: { categoryId } });
    for (const status of ['validated', 'pending', 'to_edit', 'trash'] satisfies MnemoQuestionStatus[]) {
      actions.push({
        type: 'mnemo_open_questions',
        payload: { categoryId, status },
      });
    }
    actions.push({
      type: 'mnemo_open_rename_category',
      payload: { categoryId },
    });
    actions.push({ type: 'mnemo_delete_category', payload: { categoryId } });
    actions.push({ type: 'mnemo_back', payload: {} });
    return actions;
  }

  if (view.page === 'questions') {
    const questions = deps.store.listQuestions({
      categoryId: view.categoryId,
      status: view.status,
    });
    for (const question of questions) {
      actions.push({
        type: 'mnemo_open_question',
        payload: { categoryId: view.categoryId, questionId: question.id },
      });
    }
    actions.push({ type: 'mnemo_back', payload: {} });
    return actions;
  }

  if (view.page === 'question') {
    const questionId = view.questionId;
    for (const status of ['validated', 'pending', 'to_edit', 'trash'] satisfies MnemoQuestionStatus[]) {
      actions.push({
        type: 'mnemo_set_question_status',
        payload: { questionId, status },
      });
    }
    actions.push({ type: 'mnemo_open_edit_question', payload: { questionId } });
    actions.push({ type: 'mnemo_back', payload: {} });
    return actions;
  }

  return actions;
}
