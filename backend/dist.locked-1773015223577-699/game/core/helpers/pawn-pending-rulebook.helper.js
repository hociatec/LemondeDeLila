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
    get getPendingPawnActionsForPlayer () {
        return getPendingPawnActionsForPlayer;
    },
    get validatePendingPawnActionForActor () {
        return validatePendingPawnActionForActor;
    }
});
const _pawnselectionhelper = require("./pawn-selection.helper");
function getPendingPawnActionsForPlayer(pending, playerId, pendingType = 'choose_pawn') {
    if (!(0, _pawnselectionhelper.isPendingPawnForPlayer)(pending, playerId, pendingType)) {
        return [];
    }
    return (0, _pawnselectionhelper.listPendingPawnActions)(pending, pendingType);
}
function validatePendingPawnActionForActor(params) {
    const pendingType = String(params.pendingType ?? '').trim() || 'choose_pawn';
    if (!(0, _pawnselectionhelper.isPendingPawnForPlayer)(params.pending, params.actorId, pendingType)) {
        return {
            ok: false,
            reason: 'not_pending_for_actor'
        };
    }
    if (params.actionType !== pendingType) {
        return {
            ok: false,
            reason: 'wrong_action_type'
        };
    }
    const pawnId = (0, _pawnselectionhelper.resolvePendingPawnId)(params.pending, params.payload ?? {}, params.idResolver);
    if (!pawnId) {
        return {
            ok: false,
            reason: 'invalid_pawn'
        };
    }
    return {
        ok: true,
        pawnId,
        action: {
            type: pendingType,
            payload: {
                pawnId
            }
        }
    };
}
