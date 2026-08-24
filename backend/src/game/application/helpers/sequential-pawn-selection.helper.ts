import type { GameStateEntity } from '../models/game-state.model';
import type { SetupFlowService } from '../services/setup-flow.service';
import type { GameCoreService } from '../services/game-core.service';
import { resolvePlayerNameFromState } from '../helpers/player-name.helper';
import type { PlayerStateEntity } from '../models/game-state.model';

export type SequentialPawnChoice = {
  id: string;
  label: string;
  description?: string;
  [key: string]: unknown;
};

type SequentialPawnPlayer = PlayerStateEntity & Record<string, unknown>;

export function continueSequentialPawnSelection(params: {
  state: GameStateEntity;
  setupFlow: SetupFlowService;
  core?: GameCoreService;
  chooserPlayerId: number;
  players: SequentialPawnPlayer[];
  isAssigned: (candidateId: number) => boolean;
  pawns: SequentialPawnChoice[];
  starterId?: number | null;
  pendingType?: 'choose_pawn' | 'pick_pawn';
  includeChoiceMapData?: boolean;
  choiceLabelBuilder?: (choice: SequentialPawnChoice) => string;
  pawnDataMapper?: (choice: SequentialPawnChoice) => Record<string, unknown>;
  extraPendingData?: Record<string, unknown>;
  onPending?: (state: GameStateEntity) => GameStateEntity;
  onStarted?: (
    state: GameStateEntity,
    starterPlayerId: number | null,
  ) => GameStateEntity;
}): GameStateEntity {
  const pendingInfo = params.setupFlow.createSequentialPawnPending({
    players: params.players,
    startPlayerId: params.chooserPlayerId,
    isAssigned: params.isAssigned,
    pendingType: params.pendingType,
    pawns: params.pawns,
    includeChoiceMapData: params.includeChoiceMapData,
    choiceLabelBuilder: params.choiceLabelBuilder,
    pawnDataMapper: params.pawnDataMapper,
    extraPendingData: params.extraPendingData,
  });

  if (pendingInfo) {
    let withPending: GameStateEntity = {
      ...params.state,
      pending: pendingInfo.pending,
      turnIndex: pendingInfo.turnIndex,
      turn: {
        ...(params.state.turn ?? { direction: 1 }),
        currentPlayerId: pendingInfo.playerId,
        direction:
          params.state.turn?.direction === -1 && !params.state.pending ? -1 : 1,
      },
    };
    if (params.core) {
      const prompt = `C'est à ${resolvePlayerNameFromState(withPending, pendingInfo.playerId)} de choisir son pion.`;
      const hasPrompt = Array.isArray(withPending.log)
        ? withPending.log
            .slice(-6)
            .some((entry) => String(entry?.message ?? '').trim() === prompt)
        : false;
      if (!hasPrompt) {
        withPending = params.core.appendLog(withPending, prompt);
      }
    }
    return typeof params.onPending === 'function'
      ? params.onPending(withPending)
      : withPending;
  }

  const starterId =
    typeof params.starterId === 'number' && Number.isFinite(params.starterId)
      ? params.starterId
      : (params.players[0]?.id ?? null);
  const starterIndex =
    starterId != null
      ? params.players.findIndex((player) => player?.id === starterId)
      : -1;
  const resolvedStarterId =
    starterId != null && starterIndex >= 0
      ? starterId
      : (params.players[0]?.id ?? null);

  const started: GameStateEntity = {
    ...params.state,
    pending: null,
    turnIndex: starterIndex >= 0 ? starterIndex : params.state.turnIndex,
    turn: {
      ...(params.state.turn ?? { direction: 1 }),
      currentPlayerId: resolvedStarterId,
      direction: 1,
    },
  };

  return typeof params.onStarted === 'function'
    ? params.onStarted(started, resolvedStarterId)
    : started;
}



