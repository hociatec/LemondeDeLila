import type { GameSingleActionDto } from '../models/game-action.model';
import type {
  PendingPawnChoicePayload,
  PendingPawnPayload,
} from './pawn-selection.helper';
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
  pending: PendingPawnPayload | null | undefined,
  playerId: number,
  pendingType: string = 'choose_pawn',
): GameSingleActionDto[] {
  if (!isPendingPawnForPlayer(pending, playerId, pendingType)) {
    return [];
  }
  return listPendingPawnActions(pending, pendingType);
}

export function validatePendingPawnActionForActor(params: {
  pending: PendingPawnPayload | null | undefined;
  actorId: number;
  actionType: string;
  payload?: PendingPawnChoicePayload;
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

