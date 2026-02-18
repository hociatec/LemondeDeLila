type PendingMoveOption = {
  pawnIndex: number;
  targetProgress: number;
};

function toPlayerId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isPendingPawnMoveForPlayer(
  pending: any,
  playerId: number | null,
  pendingType: string = 'choose_pawn',
): boolean {
  if (!pending || String(pending.type ?? '').trim() !== pendingType) return false;
  if (playerId == null) return false;
  const pendingPlayerId = toPlayerId(pending.playerId);
  return pendingPlayerId != null && pendingPlayerId === playerId;
}

export function getPendingPawnMoveOptions(pending: any): PendingMoveOption[] {
  const moves = Array.isArray(pending?.data?.moves) ? pending.data.moves : [];
  return moves
    .map((move: any) => ({
      pawnIndex: Number(move?.pawnIndex),
      targetProgress: Number(move?.targetProgress),
    }))
    .filter(
      (move) =>
        Number.isFinite(move.pawnIndex) && Number.isFinite(move.targetProgress),
    );
}

export function listPendingPawnMoveActions(
  pending: any,
  actionType: string = 'move_pawn',
): Array<{ type: string; payload: { pawnIndex: number; targetProgress: number } }> {
  return getPendingPawnMoveOptions(pending).map((move) => ({
    type: actionType,
    payload: {
      pawnIndex: move.pawnIndex,
      targetProgress: move.targetProgress,
    },
  }));
}

export function resolvePendingPawnMove(
  pending: any,
  payload: any,
): PendingMoveOption | null {
  const pawnIndex = Number(payload?.pawnIndex);
  const targetProgress = Number(payload?.targetProgress);
  if (!Number.isFinite(pawnIndex) || !Number.isFinite(targetProgress)) {
    return null;
  }
  const options = getPendingPawnMoveOptions(pending);
  const found = options.find(
    (move) =>
      move.pawnIndex === pawnIndex && move.targetProgress === targetProgress,
  );
  return found ?? null;
}

