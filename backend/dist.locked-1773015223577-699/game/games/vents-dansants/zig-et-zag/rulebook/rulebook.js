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
    get getAvailableActions () {
        return getAvailableActions;
    },
    get validateAction () {
        return validateAction;
    }
});
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function getMeta(state) {
    return state.metadata ?? {};
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    if (getMeta(state).winnerId != null) return [];
    const round = getMeta(state).roundState;
    if (!round) return [];
    const waiting = waitingPlayerIds(round);
    if (!waiting.length || waiting[0] !== playerId) return [];
    const actions = [];
    actions.push({
        type: 'draw_card',
        payload: {}
    });
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, _actionservicehelper.normalizeLowerActionType)(action);
    if (type !== 'draw_card') {
        throw new Error(`Action inconnue: ${action?.type}`);
    }
    if (actorId == null) {
        throw new Error('Acteur requis');
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new Error("La partie n'est pas démarrée.");
    }
    const meta = getMeta(state);
    if (meta.winnerId != null) {
        throw new Error('La partie est terminée.');
    }
    const round = meta.roundState;
    if (!round) {
        throw new Error("Ce n'est pas votre tour.");
    }
    const waiting = waitingPlayerIds(round);
    if (!waiting.length || waiting[0] !== actorId) {
        throw new Error("Ce n'est pas votre tour.");
    }
    return {
        type: 'draw_card',
        payload: {}
    };
}
function waitingPlayerIds(round) {
    return (round.waitingPlayers ?? []).map((v)=>{
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
            const n = Number(v.trim());
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }).filter((v)=>typeof v === 'number');
}
