"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const ca_definition_1 = require("../definitions/ca.definition");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
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
        if (pending.type === 'choose_next_player') {
            return (0, pending_actions_rulebook_helper_1.getPendingNumberSetChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_next_player',
                actionType: 'choose_next_player',
                payloadValueKey: 'playerId',
                valuesKey: 'playerIds',
            });
        }
        if (pending.type === 'choose_next_delta') {
            return (0, pending_actions_rulebook_helper_1.getPendingNumberSetChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_next_delta',
                actionType: 'choose_next_delta',
                payloadValueKey: 'delta',
                valuesKey: 'deltas',
            });
        }
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    return [
        { type: 'roll', payload: {} },
        { type: 'ROLL_DICE', payload: {} },
    ];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const normalized = (0, action_service_helper_1.normalizeLegacyRollAliasToUpper)(rawType);
    if (!ca_definition_1.CA_DERAPE_GAME.actions.includes(normalized)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'ca-derape',
            action: rawType,
            allowedActions: ca_definition_1.CA_DERAPE_GAME.actions,
        });
    }
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Acteur requis.', { gameType: 'ca-derape' });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'ca-derape',
        });
    }
    const pending = state.pending;
    if (pending) {
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: normalized,
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pending.type === 'draw' &&
            drawValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'ca-derape',
            });
        }
        const targetValidation = (0, pending_actions_rulebook_helper_1.validatePendingChooseTargetActionForActor)({
            pending,
            actorId,
            actionType: normalized,
            payload: action.payload ?? {},
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        if (pending.type === 'choose_target' &&
            targetValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Choix invalide.', {
                gameType: 'ca-derape',
            });
        }
        if (pending.type === 'choose_target' &&
            targetValidation.reason === 'invalid_target') {
            throw new game_errors_1.GameValidationError('Cible invalide.', {
                gameType: 'ca-derape',
                targetPlayerId: targetValidation.targetPlayerId,
            });
        }
        if (pending.playerId !== actorId) {
            throw new game_errors_1.PlayerActionError('Action réservée à un autre joueur.', {
                gameType: 'ca-derape',
            });
        }
        if (pending.type === 'choose_next_player') {
            const playerValidation = (0, pending_actions_rulebook_helper_1.validatePendingNumberSetChoiceActionForActor)({
                pending,
                actorId,
                actionType: normalized,
                payload: action.payload ?? {},
                pendingType: 'choose_next_player',
                expectedActionType: 'choose_next_player',
                payloadValueKey: 'playerId',
                valuesKey: 'playerIds',
            });
            if (!playerValidation.ok &&
                playerValidation.reason === 'wrong_action_type') {
                throw new game_errors_1.PlayerActionError('Choix invalide.', {
                    gameType: 'ca-derape',
                });
            }
            if (!playerValidation.ok) {
                const payload = asRecord(action.payload);
                throw new game_errors_1.GameValidationError('Joueur invalide.', {
                    gameType: 'ca-derape',
                    playerId: toNumber(payload.playerId),
                });
            }
            return playerValidation.action;
        }
        if (pending.type === 'choose_next_delta') {
            const deltaValidation = (0, pending_actions_rulebook_helper_1.validatePendingNumberSetChoiceActionForActor)({
                pending,
                actorId,
                actionType: normalized,
                payload: action.payload ?? {},
                pendingType: 'choose_next_delta',
                expectedActionType: 'choose_next_delta',
                payloadValueKey: 'delta',
                valuesKey: 'deltas',
            });
            if (!deltaValidation.ok &&
                deltaValidation.reason === 'wrong_action_type') {
                throw new game_errors_1.PlayerActionError('Choix invalide.', {
                    gameType: 'ca-derape',
                });
            }
            if (!deltaValidation.ok) {
                const payload = asRecord(action.payload);
                throw new game_errors_1.GameValidationError('Choix invalide.', {
                    gameType: 'ca-derape',
                    delta: toNumber(payload.delta),
                });
            }
            return deltaValidation.action;
        }
        throw new game_errors_1.PlayerActionError('Choix invalide.', { gameType: 'ca-derape' });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'ca-derape',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if ((0, action_service_helper_1.isRollActionType)(rawType)) {
        return { type: 'roll', payload: {} };
    }
    return { type: normalized, payload: action.payload ?? {} };
}
function asRecord(value) {
    if (value == null || typeof value !== 'object')
        return {};
    return value;
}
function toNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : NaN;
    }
    if (typeof value !== 'string') {
        return NaN;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
}
//# sourceMappingURL=ca.rulebook.js.map