"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingPawnMoveOptions = getPendingPawnMoveOptions;
exports.listPendingPawnMoveActions = listPendingPawnMoveActions;
exports.resolvePendingPawnMove = resolvePendingPawnMove;
function getPendingPawnMoveOptions(pending) {
    const movesRaw = Array.isArray(pending?.data?.moves)
        ? pending.data.moves
        : [];
    const moves = movesRaw.filter((move) => Boolean(move) && typeof move === 'object');
    return moves
        .map((move) => ({
        pawnIndex: Number(move.pawnIndex),
        targetProgress: Number(move.targetProgress),
    }))
        .filter((move) => Number.isFinite(move.pawnIndex) && Number.isFinite(move.targetProgress));
}
function listPendingPawnMoveActions(pending, actionType = 'move_pawn') {
    return getPendingPawnMoveOptions(pending).map((move) => ({
        type: actionType,
        payload: {
            pawnIndex: move.pawnIndex,
            targetProgress: move.targetProgress,
        },
    }));
}
function resolvePendingPawnMove(pending, payload) {
    const pawnIndex = Number(payload?.pawnIndex);
    const targetProgress = Number(payload?.targetProgress);
    if (!Number.isFinite(pawnIndex) || !Number.isFinite(targetProgress)) {
        return null;
    }
    const options = getPendingPawnMoveOptions(pending);
    const found = options.find((move) => move.pawnIndex === pawnIndex && move.targetProgress === targetProgress);
    return found ?? null;
}
//# sourceMappingURL=pawn-move-selection.helper.js.map