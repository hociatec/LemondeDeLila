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
    get getPendingPawnMoveActionsForPlayer () {
        return getPendingPawnMoveActionsForPlayer;
    },
    get validatePendingPawnMoveActionForActor () {
        return validatePendingPawnMoveActionForActor;
    }
});
const _pawnselectionhelper = require("./pawn-selection.helper");
const _pawnmoveselectionhelper = require("./pawn-move-selection.helper");
function getPendingPawnMoveActionsForPlayer(pending, playerId, pendingType = 'choose_pawn', actionType = 'move_pawn') {
    if (!(0, _pawnselectionhelper.isPendingPawnForPlayer)(pending, playerId, pendingType)) {
        return [];
    }
    return (0, _pawnmoveselectionhelper.listPendingPawnMoveActions)(pending, actionType);
}
function validatePendingPawnMoveActionForActor(params) {
    const pendingType = String(params.pendingType ?? '').trim() || 'choose_pawn';
    const expectedActionType = String(params.expectedActionType ?? '').trim() || 'move_pawn';
    if (!(0, _pawnselectionhelper.isPendingPawnForPlayer)(params.pending, params.actorId, pendingType)) {
        return {
            ok: false,
            reason: 'not_pending_for_actor'
        };
    }
    if (params.actionType !== expectedActionType) {
        return {
            ok: false,
            reason: 'wrong_action_type'
        };
    }
    const move = (0, _pawnmoveselectionhelper.resolvePendingPawnMove)(params.pending, params.payload ?? {});
    if (!move) {
        return {
            ok: false,
            reason: 'invalid_move'
        };
    }
    return {
        ok: true,
        move,
        action: {
            type: expectedActionType,
            payload: move
        }
    };
}
