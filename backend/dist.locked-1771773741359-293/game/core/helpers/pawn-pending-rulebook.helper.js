"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingPawnActionsForPlayer = getPendingPawnActionsForPlayer;
exports.validatePendingPawnActionForActor = validatePendingPawnActionForActor;
const pawn_selection_helper_1 = require("./pawn-selection.helper");
function getPendingPawnActionsForPlayer(pending, playerId, pendingType = 'choose_pawn') {
    if (!(0, pawn_selection_helper_1.isPendingPawnForPlayer)(pending, playerId, pendingType)) {
        return [];
    }
    return (0, pawn_selection_helper_1.listPendingPawnActions)(pending, pendingType);
}
function validatePendingPawnActionForActor(params) {
    const pendingType = String(params.pendingType ?? '').trim() || 'choose_pawn';
    if (!(0, pawn_selection_helper_1.isPendingPawnForPlayer)(params.pending, params.actorId, pendingType)) {
        return { ok: false, reason: 'not_pending_for_actor' };
    }
    if (params.actionType !== pendingType) {
        return { ok: false, reason: 'wrong_action_type' };
    }
    const pawnId = (0, pawn_selection_helper_1.resolvePendingPawnId)(params.pending, params.payload ?? {}, params.idResolver);
    if (!pawnId) {
        return { ok: false, reason: 'invalid_pawn' };
    }
    return {
        ok: true,
        pawnId,
        action: { type: pendingType, payload: { pawnId } },
    };
}
//# sourceMappingURL=pawn-pending-rulebook.helper.js.map