"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingPawnMoveActionsForPlayer = getPendingPawnMoveActionsForPlayer;
exports.validatePendingPawnMoveActionForActor = validatePendingPawnMoveActionForActor;
const pawn_selection_helper_1 = require("./pawn-selection.helper");
const pawn_move_selection_helper_1 = require("./pawn-move-selection.helper");
function getPendingPawnMoveActionsForPlayer(pending, playerId, pendingType = 'choose_pawn', actionType = 'move_pawn') {
    if (!(0, pawn_selection_helper_1.isPendingPawnForPlayer)(pending, playerId, pendingType)) {
        return [];
    }
    return (0, pawn_move_selection_helper_1.listPendingPawnMoveActions)(pending, actionType);
}
function validatePendingPawnMoveActionForActor(params) {
    const pendingType = String(params.pendingType ?? '').trim() || 'choose_pawn';
    const expectedActionType = String(params.expectedActionType ?? '').trim() || 'move_pawn';
    if (!(0, pawn_selection_helper_1.isPendingPawnForPlayer)(params.pending, params.actorId, pendingType)) {
        return { ok: false, reason: 'not_pending_for_actor' };
    }
    if (params.actionType !== expectedActionType) {
        return { ok: false, reason: 'wrong_action_type' };
    }
    const move = (0, pawn_move_selection_helper_1.resolvePendingPawnMove)(params.pending, params.payload ?? {});
    if (!move) {
        return { ok: false, reason: 'invalid_move' };
    }
    return {
        ok: true,
        move,
        action: { type: expectedActionType, payload: move },
    };
}
//# sourceMappingURL=pending-pawn-move-rulebook.helper.js.map