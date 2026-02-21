type PendingMoveOption = {
  pawnIndex: number;
  targetProgress: number;
};

type PendingMoveData = {
  data?: {
    moves?: unknown;
  };
};

type MovePayload = {
  pawnIndex?: unknown;
  targetProgress?: unknown;
};

export function getPendingPawnMoveOptions(
  pending: PendingMoveData,
): PendingMoveOption[] {
  const movesRaw = Array.isArray(pending?.data?.moves)
    ? pending.data.moves
    : [];
  const moves = movesRaw.filter(
    (move): move is Record<string, unknown> =>
      Boolean(move) && typeof move === 'object',
  );
  return moves
    .map((move) => ({
      pawnIndex: Number(move.pawnIndex),
      targetProgress: Number(move.targetProgress),
    }))
    .filter(
      (move) =>
        Number.isFinite(move.pawnIndex) && Number.isFinite(move.targetProgress),
    );
}

export function listPendingPawnMoveActions(
  pending: PendingMoveData,
  actionType: string = 'move_pawn',
): Array<{
  type: string;
  payload: { pawnIndex: number; targetProgress: number };
}> {
  return getPendingPawnMoveOptions(pending).map((move) => ({
    type: actionType,
    payload: {
      pawnIndex: move.pawnIndex,
      targetProgress: move.targetProgress,
    },
  }));
}

export function resolvePendingPawnMove(
  pending: PendingMoveData,
  payload: MovePayload,
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
