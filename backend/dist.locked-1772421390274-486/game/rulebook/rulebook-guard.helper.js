"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get canPlayerActOnTurn () {
        return canPlayerActOnTurn;
    },
    get getCurrentTurnPlayerId () {
        return getCurrentTurnPlayerId;
    },
    get hasPendingState () {
        return hasPendingState;
    },
    get isStartedState () {
        return isStartedState;
    }
});
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
    if (!isStartedState(state)) return false;
    if (!options?.allowPending && hasPendingState(state)) return false;
    return getCurrentTurnPlayerId(state) === playerId;
}
