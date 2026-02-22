"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStartedState = isStartedState;
exports.getCurrentTurnPlayerId = getCurrentTurnPlayerId;
exports.hasPendingState = hasPendingState;
exports.canPlayerActOnTurn = canPlayerActOnTurn;
function isStartedState(state) {
    return String(state.status ?? '').toLowerCase() === 'started';
}
function getCurrentTurnPlayerId(state) {
    return state.turn?.currentPlayerId ?? null;
}
function hasPendingState(state) {
    return state.pending != null;
}
function canPlayerActOnTurn(state, playerId, options) {
    if (!isStartedState(state))
        return false;
    if (!options?.allowPending && hasPendingState(state))
        return false;
    return getCurrentTurnPlayerId(state) === playerId;
}
//# sourceMappingURL=rulebook-guard.helper.js.map