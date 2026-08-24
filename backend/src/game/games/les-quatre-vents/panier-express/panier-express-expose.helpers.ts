import {
  GameStateEntity,
  PendingState,
} from '../../../application/models/game-state.model';
import {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../models/game-action.model';
import { QuizQuestion } from '../../../application/features/quiz/services/quiz-runner.service';
import { PanierExpressMetadata } from './model/panier-express-state.model';
import { toPlayerIdValue } from './panier-express-state.helpers';

type BuildExposedPanierExpressStateArgs = {
  state: GameStateEntity;
  meta: PanierExpressMetadata;
  requestedUserId?: number | null;
  getActions: (viewerId: number) => GameSingleActionDto[];
  expose: (args: {
    state: GameStateEntity;
    actions: GameSingleActionDto[];
    rawPending: PendingState | null;
    pendingQuiz: QuizQuestion | undefined;
    currentId: number | null;
  }) => GameStateWithActions;
};

export function buildExposedPanierExpressState(
  args: BuildExposedPanierExpressStateArgs,
): GameStateWithActions {
  const currentId =
    args.requestedUserId == null
      ? toPlayerIdValue(args.state.turn?.currentPlayerId)
      : resolveViewerId(args.state, args.requestedUserId);

  const current =
    currentId == null
      ? null
      : ((args.state.players ?? []).find(
          (player) => toPlayerIdValue(player?.id) === currentId,
        ) ?? null);
  const isBot = current?.isBot === true;
  const actions =
    !isBot && typeof currentId === 'number' ? args.getActions(currentId) : [];
  const rawPending: PendingState | null = args.state.pending ?? null;
  const pendingQuiz: QuizQuestion | undefined =
    typeof currentId === 'number'
      ? (args.meta.quiz.pending[currentId] ?? undefined)
      : undefined;

  return args.expose({
    state: args.state,
    actions,
    rawPending,
    pendingQuiz,
    currentId,
  });
}

function resolveViewerId(
  state: GameStateEntity,
  requestedUserId: number,
): number | null {
  const viewerId = toPlayerIdValue(requestedUserId);
  return viewerId != null &&
    (state.players ?? []).some(
      (player) => toPlayerIdValue(player?.id) === viewerId,
    )
    ? viewerId
    : null;
}






