import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../application/models/game-action.model';
import { formatPresenterActions } from '../../../../../application/helpers/actions-presenter.helper';
import type { MnemoQuizMetadata } from '../../model/mnemo-quiz.model';
import type { ArcheMnemoStateService } from './arche-mnemo-state.service';
import type { RandomService } from '../../../../../application/services/random.service';
import type { MnemoQuizStore } from '../ports/mnemo-quiz-store.port';

type ArcheViewDeps = {
  stateSvc: ArcheMnemoStateService;
  random: RandomService;
  store: MnemoQuizStore;
  buildPendingForUser: (
    state: GameStateEntity,
    userId: number,
  ) => Record<string, unknown> | null;
  buildActionsForUser: (
    state: GameStateEntity,
    userId: number,
  ) => GameSingleActionDto[];
  asRecord: (value: unknown) => Record<string, unknown>;
};

export function exposeArcheStateForUser(
  deps: ArcheViewDeps,
  state: GameStateEntity,
  userId: number,
): GameStateWithActions {
  const meta = deps.stateSvc.getMeta(state);
  const { quizAnswersByPlayerId: _quizAnswersByPlayerId, ...metaRest } = meta;
  const built = deps.buildPendingForUser(state, userId);
  const actions = deps.buildActionsForUser(state, userId);
  const players = Array.isArray(state.players) ? state.players : [];

  const scoreByPlayerId = deps.stateSvc.asRecord(meta?.scoresByPlayerId) as Record<
    number,
    number
  >;
  const scoreLines = players
    .filter((p) => p && Number.isFinite(Number(p.id)))
    .map((p) => ({
      id: Number(p.id),
      name: String(p.username ?? `#${p.id}`),
      score: Number(scoreByPlayerId[Number(p.id)] ?? 0),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));

  const targetPoints = Number(meta?.config?.targetPoints ?? 20);
  const safeTargetPoints =
    Number.isFinite(targetPoints) && targetPoints > 0
      ? Math.trunc(targetPoints)
      : 20;
  const scoreMessage = scoreLines.length
    ? `Score: ${scoreLines.map((s) => `${s.name}: ${s.score}`).join(', ')}. Objectif: ${safeTargetPoints} point(s).`
    : `Score: indisponible. Objectif: ${safeTargetPoints} point(s).`;

  const safeMeta: Record<string, unknown> = {
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
  if (!deps.stateSvc.isOwner(state, userId)) {
    safeMeta.adminView = { page: 'setup' };
    safeMeta.prompt = null;
    safeMeta.promptOwnerId = null;
  }

  return {
    ...state,
    metadata: safeMeta,
    actions: formatPresenterActions(actions),
    pending: built as GameStateEntity['pending'],
    extras: {
      ...(deps.asRecord(state.extras) ?? {}),
      ui: {
        ...(deps.asRecord(deps.asRecord(state.extras).ui) ?? {}),
        panels: {
          ...(deps.asRecord(deps.asRecord(deps.asRecord(state.extras).ui).panels) ??
            {}),
          score: { title: 'Score', message: scoreMessage },
        },
      },
    },
  };
}

export function getArcheBotActions(
  deps: Pick<ArcheViewDeps, 'stateSvc' | 'random' | 'store'>,
  state: GameStateEntity,
  botPlayerId: number,
): GameSingleActionDto[] | null {
  const meta = deps.stateSvc.getMeta(state);
  const phase = String(state.phase ?? '')
    .toLowerCase()
    .trim();
  const currentId = state.turn?.currentPlayerId ?? null;

  if (currentId !== botPlayerId) return null;

  if (phase === 'setup') {
    if (meta.prompt) {
      const ownerId = deps.stateSvc.getPromptOwnerId(meta);
      if (ownerId === botPlayerId) {
        return [{ type: 'mnemo_set_config', payload: {} }];
      }
      return null;
    }

    const categories = deps.store.listCategories();
    const categoryIds = categories.map((c) => c.id);
    const choices = [...categoryIds, null];
    const pickIndex = deps.random.pickIndex(
      deps.stateSvc.asRecord(meta),
      choices.length,
    ).index;
    const chosen = choices[pickIndex] ?? null;
    return [{ type: 'mnemo_start', payload: { categoryId: chosen } }];
  }

  const q = meta.currentQuestion;
  if (!q) {
    return [{ type: 'draw', payload: {} }];
  }

  const players = Array.isArray(state.players) ? state.players : [];
  const bot = players.find((p) => p?.id === botPlayerId);
  if (!bot?.isBot) return null;

  const answers = deps.stateSvc.getQuizAnswers(meta);
  if (answers[botPlayerId] != null) return null;

  const choicesLen = Math.min(4, Math.max(0, q.choices?.length ?? 0));
  if (choicesLen <= 0) return null;

  const answerIndex = deps.random.pickIndex(
    deps.stateSvc.asRecord(meta),
    choicesLen,
  ).index;

  return [{ type: 'answer_quiz', payload: { answerIndex } }];
}
