"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const odyssee_definition_1 = require("../definitions/odyssee.definition");
const pending_pawn_move_rulebook_helper_1 = require("../../../../core/helpers/pending-pawn-move-rulebook.helper");
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = state.pending;
    if (pending) {
        const pendingMoveActions = (0, pending_pawn_move_rulebook_helper_1.getPendingPawnMoveActionsForPlayer)(pending, playerId, 'choose_pawn', 'move_pawn');
        if (pendingMoveActions.length > 0) {
            return pendingMoveActions;
        }
        const pendingRow = asRecord(pending);
        if (Number(pendingRow.playerId ?? null) !== playerId)
            return [];
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const type = (0, action_service_helper_1.normalizeLegacyRollAliasToUpper)(rawType);
    if (!odyssee_definition_1.ODYSSEE_GAME.actions.includes(type)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'odyssee-quatre-cieux',
            action: rawType,
            allowedActions: odyssee_definition_1.ODYSSEE_GAME.actions,
        });
    }
    if (actorId == null)
        throw new game_errors_1.PlayerActionError('Acteur requis.', {
            gameType: 'odyssee-quatre-cieux',
        });
    if (!(0, rulebook_guard_helper_1.isStartedState)(state)) {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'odyssee-quatre-cieux',
        });
    }
    const pending = state.pending;
    if (pending) {
        const moveValidation = (0, pending_pawn_move_rulebook_helper_1.validatePendingPawnMoveActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn',
            expectedActionType: 'move_pawn',
        });
        if (!moveValidation.ok && moveValidation.reason === 'not_pending_for_actor')
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'odyssee-quatre-cieux',
            });
        if (!moveValidation.ok && moveValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'odyssee-quatre-cieux',
            });
        }
        if (!moveValidation.ok) {
            throw new game_errors_1.GameValidationError('Payload invalide.', {
                gameType: 'odyssee-quatre-cieux',
                payload: action.payload,
            });
        }
        return moveValidation.action;
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'odyssee-quatre-cieux',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if (type === 'ROLL_DICE')
        return { type: 'roll', payload: {} };
    return { type: 'roll', payload: {} };
}
//# sourceMappingURL=rulebook.js.map