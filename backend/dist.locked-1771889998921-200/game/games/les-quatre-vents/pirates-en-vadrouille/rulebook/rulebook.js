"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const game_errors_1 = require("../../../../../common/errors/game-errors");
const pirates_en_vadrouille_definition_1 = require("../definitions/pirates-en-vadrouille.definition");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
function isPiratesActionType(value) {
    return pirates_en_vadrouille_definition_1.PIRATES_GAME.actions.includes(value);
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = state.pending;
    if (pending) {
        const targetActions = (0, pending_actions_rulebook_helper_1.getPendingChooseTargetActionsForPlayer)(pending, playerId, { targetsKey: 'options' });
        if (targetActions.length > 0)
            return targetActions;
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    return [{ type: 'roll', payload: {} }];
}
function validateAction(state, action, actorId) {
    const normalizedType = (0, action_service_helper_1.normalizeActionType)(action);
    const rawType = typeof normalizedType === 'string' ? normalizedType : '';
    const maybeType = (0, action_service_helper_1.isRollAlias)(rawType) ? 'roll' : rawType;
    if (!isPiratesActionType(maybeType)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'pirates-en-vadrouille',
            action: rawType,
            allowedActions: pirates_en_vadrouille_definition_1.PIRATES_GAME.actions,
        });
    }
    const type = maybeType;
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Acteur requis.', {
            gameType: 'pirates-en-vadrouille',
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'pirates-en-vadrouille',
        });
    }
    const pending = state.pending;
    if (pending) {
        const targetValidation = (0, pending_actions_rulebook_helper_1.validatePendingChooseTargetActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            targetsKey: 'options',
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        const pendingRow = asRecord(pending);
        if (pendingRow.type === 'choose_target' &&
            targetValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'pirates-en-vadrouille',
            });
        }
        if (pendingRow.type === 'choose_target' &&
            targetValidation.reason === 'invalid_target') {
            throw new game_errors_1.GameValidationError('Cible invalide.', {
                gameType: 'pirates-en-vadrouille',
                targetPlayerId: targetValidation.targetPlayerId,
            });
        }
        if (Number(pendingRow.playerId ?? null) !== actorId) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'pirates-en-vadrouille',
            });
        }
        throw new game_errors_1.PlayerActionError('Action non disponible.', {
            gameType: 'pirates-en-vadrouille',
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'pirates-en-vadrouille',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if (type === 'roll')
        return { type: 'roll', payload: action.payload ?? {} };
    return action;
}
//# sourceMappingURL=rulebook.js.map