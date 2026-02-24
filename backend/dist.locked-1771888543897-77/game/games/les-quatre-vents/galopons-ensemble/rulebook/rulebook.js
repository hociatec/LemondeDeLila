"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const galopons_definition_1 = require("../definitions/galopons.definition");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
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
        const drawActions = (0, pending_actions_rulebook_helper_1.getPendingDrawActionsForPlayer)(pending, playerId);
        if (drawActions.length > 0)
            return drawActions;
        const targetActions = (0, pending_actions_rulebook_helper_1.getPendingChooseTargetActionsForPlayer)(pending, playerId);
        if (targetActions.length > 0)
            return targetActions;
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
    if (!galopons_definition_1.GALOPONS_GAME.actions.includes(type)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'galopons-ensemble',
            action: rawType,
            allowedActions: galopons_definition_1.GALOPONS_GAME.actions,
        });
    }
    if (actorId == null)
        throw new game_errors_1.PlayerActionError('Acteur requis.', {
            gameType: 'galopons-ensemble',
        });
    if (!(0, rulebook_guard_helper_1.isStartedState)(state)) {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'galopons-ensemble',
        });
    }
    const pending = state.pending;
    if (pending) {
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type,
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        const pendingRow = asRecord(pending);
        if (pendingRow.type === 'draw' &&
            drawValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'galopons-ensemble',
            });
        }
        const targetValidation = (0, pending_actions_rulebook_helper_1.validatePendingChooseTargetActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        if (pendingRow.type === 'choose_target' &&
            targetValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Choix invalide.', {
                gameType: 'galopons-ensemble',
            });
        }
        if (pendingRow.type === 'choose_target' &&
            targetValidation.reason === 'invalid_target') {
            throw new game_errors_1.GameValidationError('Cible invalide.', {
                gameType: 'galopons-ensemble',
                targetPlayerId: targetValidation.targetPlayerId,
            });
        }
        if (Number(pendingRow.playerId ?? null) !== actorId) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'galopons-ensemble',
            });
        }
        throw new game_errors_1.PlayerActionError('Action non disponible.', {
            gameType: 'galopons-ensemble',
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'galopons-ensemble',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if (type === 'ROLL_DICE')
        return { type: 'roll', payload: {} };
    return { type, payload: action.payload ?? {} };
}
//# sourceMappingURL=rulebook.js.map