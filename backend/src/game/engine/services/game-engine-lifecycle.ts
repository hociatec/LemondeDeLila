import type { GameStateWithActions } from '../dto/game-action.dto';

export function isPawnPendingType(pendingType: string): boolean {
  const normalized = String(pendingType ?? '')
    .trim()
    .toLowerCase();
  return normalized === 'choose_pawn' || normalized === 'pick_pawn';
}

export function attachStartLifecycle(params: {
  state: GameStateWithActions;
  userId?: number;
}): GameStateWithActions {
  const { state, userId } = params;

  const status = String(state?.status ?? '')
    .toLowerCase()
    .trim();
  const pendingType = String(state?.pending?.type ?? '')
    .toLowerCase()
    .trim();
  const currentPlayerId =
    typeof state?.turn?.currentPlayerId === 'number'
      ? state.turn.currentPlayerId
      : null;
  const hasActions = Array.isArray(state?.actions) && state.actions.length > 0;
  const botThinking = state?.botThinking === true;

  const pendingPlayerIdRaw = state?.pending?.playerId;
  const pendingPlayerId =
    typeof pendingPlayerIdRaw === 'number'
      ? pendingPlayerIdRaw
      : Number(pendingPlayerIdRaw);
  const viewerPendingTurn =
    userId != null &&
    Number.isFinite(pendingPlayerId) &&
    pendingPlayerId === userId;
  const viewerPendingFallback =
    userId != null &&
    !Number.isFinite(pendingPlayerId) &&
    currentPlayerId != null &&
    currentPlayerId === userId;

  const started = status === 'started';
  const hasConfigPrompt =
    pendingType === 'config_prompt' || pendingType.endsWith('_set_config');
  const startReady = started && !hasConfigPrompt;
  const viewerMustChoosePawn =
    userId != null &&
    started &&
    isPawnPendingType(pendingType) &&
    (viewerPendingTurn || viewerPendingFallback);
  const viewerTurnActionable =
    userId != null &&
    started &&
    currentPlayerId != null &&
    currentPlayerId === userId &&
    hasActions &&
    !botThinking &&
    !viewerMustChoosePawn;

  const metadataRaw =
    state?.metadata && typeof state.metadata === 'object'
      ? (state.metadata as Record<string, unknown>)
      : {};

  const lifecycleRawCandidate = metadataRaw['lifecycle'];
  const lifecycleRaw =
    lifecycleRawCandidate &&
    typeof lifecycleRawCandidate === 'object' &&
    !Array.isArray(lifecycleRawCandidate)
      ? (lifecycleRawCandidate as Record<string, unknown>)
      : {};

  const currentStartReady = lifecycleRaw['startReady'];
  const currentViewerTurnActionable = lifecycleRaw['viewerTurnActionable'];
  const currentViewerMustChoosePawn = lifecycleRaw['viewerMustChoosePawn'];
  if (
    typeof currentStartReady === 'boolean' &&
    currentStartReady === startReady &&
    typeof currentViewerTurnActionable === 'boolean' &&
    currentViewerTurnActionable === viewerTurnActionable &&
    typeof currentViewerMustChoosePawn === 'boolean' &&
    currentViewerMustChoosePawn === viewerMustChoosePawn
  ) {
    return state;
  }

  return {
    ...state,
    metadata: {
      ...metadataRaw,
      lifecycle: {
        ...lifecycleRaw,
        startReady,
        viewerTurnActionable,
        viewerMustChoosePawn,
      },
    },
  };
}
