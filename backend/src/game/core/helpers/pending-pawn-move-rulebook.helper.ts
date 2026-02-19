import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';
import { isPendingPawnForPlayer } from './pawn-selection.helper';
import {
  listPendingPawnMoveActions,
  resolvePendingPawnMove,
} from './pawn-move-selection.helper';

type PendingPawnMoveFailureReason =
  | 'not_pending_for_actor'
  | 'wrong_action_type'
  | 'invalid_move';

export type PendingPawnMoveValidationResult =
  | {
      ok: true;
      action: GameSingleActionDto;
      move: { pawnIndex: number; targetProgress: number };
    }
  | { ok: false; reason: PendingPawnMoveFailureReason };

export function getPendingPawnMoveActionsForPlayer(
  pending: any,
  playerId: number,
  pendingType: string = 'choose_pawn',
  actionType: string = 'move_pawn',
): GameSingleActionDto[] {
  if (!isPendingPawnForPlayer(pending, playerId, pendingType)) {
    return [];
  }
  return listPendingPawnMoveActions(pending, actionType);
}

export function validatePendingPawnMoveActionForActor(params: {
  pending: any;
  actorId: number | null;
  actionType: string;
  payload: any;
  pendingType?: string;
  expectedActionType?: string;
}): PendingPawnMoveValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_pawn';
  const expectedActionType =
    String(params.expectedActionType ?? '').trim() || 'move_pawn';

  if (!isPendingPawnForPlayer(params.pending, params.actorId, pendingType)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const move = resolvePendingPawnMove(params.pending, params.payload ?? {});
  if (!move) {
    return { ok: false, reason: 'invalid_move' };
  }

  return {
    ok: true,
    move,
    action: { type: expectedActionType, payload: move },
  };
}
