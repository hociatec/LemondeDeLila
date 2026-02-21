import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';
import {
  isPendingPawnForPlayer,
  listPendingPawnActions,
  resolvePendingPawnId,
} from './pawn-selection.helper';

type PendingPawnFailureReason =
  | 'not_pending_for_actor'
  | 'wrong_action_type'
  | 'invalid_pawn';

export type PendingPawnValidationResult =
  | { ok: true; action: GameSingleActionDto; pawnId: string }
  | { ok: false; reason: PendingPawnFailureReason };

export function getPendingPawnActionsForPlayer(
  pending: any,
  playerId: number,
  pendingType: string = 'choose_pawn',
): GameSingleActionDto[] {
  if (!isPendingPawnForPlayer(pending, playerId, pendingType)) {
    return [];
  }
  return listPendingPawnActions(pending, pendingType);
}

export function validatePendingPawnActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  payload: any;
  pendingType?: string;
  idResolver?: (value: unknown) => string;
}): PendingPawnValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_pawn';
  if (!isPendingPawnForPlayer(params.pending, params.actorId, pendingType)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== pendingType) {
    return { ok: false, reason: 'wrong_action_type' };
  }
  const pawnId = resolvePendingPawnId(
    params.pending,
    params.payload ?? {},
    params.idResolver,
  );
  if (!pawnId) {
    return { ok: false, reason: 'invalid_pawn' };
  }
  return {
    ok: true,
    pawnId,
    action: { type: pendingType, payload: { pawnId } },
  };
}
