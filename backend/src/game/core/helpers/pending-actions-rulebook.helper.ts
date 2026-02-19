import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';

type PendingActionFailureReason =
  | 'not_pending_for_actor'
  | 'wrong_action_type'
  | 'invalid_target';

export type PendingDrawValidationResult =
  | { ok: true; action: GameSingleActionDto }
  | { ok: false; reason: Exclude<PendingActionFailureReason, 'invalid_target'> };

export type PendingChooseTargetValidationResult =
  | { ok: true; action: GameSingleActionDto; targetPlayerId: number }
  | { ok: false; reason: PendingActionFailureReason; targetPlayerId?: number };

function defaultSamePlayer(a: unknown, b: unknown): boolean {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

export function getPendingDrawActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'draw';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];
  return [{ type: pendingType, payload: {} }];
}

export function validatePendingDrawActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  pendingType?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingDrawValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'draw';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== pendingType) {
    return { ok: false, reason: 'wrong_action_type' };
  }
  return { ok: true, action: { type: pendingType, payload: {} } };
}

export function getPendingChooseTargetActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    targetKey?: string;
    targetsKey?: string;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'choose_target';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  const targetKey = String(options?.targetKey ?? '').trim() || 'targetPlayerId';
  const targetsKey = String(options?.targetsKey ?? '').trim() || 'targets';
  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];
  const targets: Array<Record<string, any>> = Array.isArray(
    pending?.data?.[targetsKey],
  )
    ? pending.data[targetsKey]
    : [];
  return targets
    .map((target) => Number(target?.[targetKey]))
    .filter((value) => Number.isFinite(value))
    .map((targetPlayerId) => ({
      type: pendingType,
      payload: { [targetKey]: targetPlayerId },
    }));
}

export function validatePendingChooseTargetActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  payload: any;
  pendingType?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
  targetKey?: string;
  targetsKey?: string;
}): PendingChooseTargetValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_target';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  const targetKey = String(params.targetKey ?? '').trim() || 'targetPlayerId';
  const targetsKey = String(params.targetsKey ?? '').trim() || 'targets';
  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== pendingType) {
    return { ok: false, reason: 'wrong_action_type' };
  }
  const targets: Array<Record<string, any>> = Array.isArray(
    params.pending?.data?.[targetsKey],
  )
    ? params.pending.data[targetsKey]
    : [];
  const targetPlayerId = Number(params.payload?.[targetKey]);
  if (
    !Number.isFinite(targetPlayerId) ||
    !targets.some((t) => Number(t?.[targetKey]) === targetPlayerId)
  ) {
    return { ok: false, reason: 'invalid_target', targetPlayerId };
  }
  return {
    ok: true,
    targetPlayerId,
    action: { type: pendingType, payload: { [targetKey]: targetPlayerId } },
  };
}
