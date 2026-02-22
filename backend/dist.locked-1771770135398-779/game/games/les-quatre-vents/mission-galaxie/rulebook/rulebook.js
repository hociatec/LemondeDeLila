"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const mission_galaxie_definition_1 = require("../definitions/mission-galaxie.definition");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
function readEventMoveOptions(pending) {
    const row = asRecord(pending);
    const data = asRecord(row.data);
    const options = Array.isArray(data.options) ? data.options : [];
    return options
        .map((entry) => {
        const option = asRecord(entry);
        return {
            targetPlayerId: Number(option.targetPlayerId),
            delta: Number(option.delta),
        };
    })
        .filter((entry) => Number.isFinite(entry.targetPlayerId) && Number.isFinite(entry.delta));
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = state.pending;
    if (pending) {
        const pendingRow = asRecord(pending);
        if (Number(pendingRow.playerId ?? null) !== playerId)
            return [];
        const drawActions = (0, pending_actions_rulebook_helper_1.getPendingDrawActionsForPlayer)(pending, playerId);
        if (drawActions.length > 0)
            return drawActions;
        if (pendingRow.type === 'choose_option') {
            return (0, pending_actions_rulebook_helper_1.getPendingIndexedChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_option',
                actionType: 'choose_option',
                payloadIndexKey: 'choiceIndex',
                choicesContainer: 'data',
                choicesKey: 'choices',
            });
        }
        if (pendingRow.type === 'choose_event_move') {
            const options = readEventMoveOptions(pending);
            return options.map((opt) => ({
                type: 'choose_event_move',
                payload: { targetPlayerId: opt.targetPlayerId, delta: opt.delta },
            }));
        }
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
    if (!mission_galaxie_definition_1.MISSION_GALAXIE_GAME.actions.includes(type)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'mission-galaxie',
            action: rawType,
            allowedActions: mission_galaxie_definition_1.MISSION_GALAXIE_GAME.actions,
        });
    }
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Acteur requis.', {
            gameType: 'mission-galaxie',
        });
    }
    if (!(0, rulebook_guard_helper_1.isStartedState)(state)) {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'mission-galaxie',
        });
    }
    const pending = state.pending;
    if (pending) {
        const pendingRow = asRecord(pending);
        if (Number(pendingRow.playerId ?? null) !== actorId) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'mission-galaxie',
            });
        }
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type,
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pendingRow.type === 'draw' &&
            drawValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'mission-galaxie',
            });
        }
        if (pendingRow.type === 'choose_option') {
            const choiceValidation = (0, pending_actions_rulebook_helper_1.validatePendingIndexedChoiceActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_option',
                expectedActionType: 'choose_option',
                payloadIndexKey: 'choiceIndex',
                choicesContainer: 'data',
                choicesKey: 'choices',
            });
            if (!choiceValidation.ok &&
                choiceValidation.reason === 'wrong_action_type') {
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: 'mission-galaxie',
                });
            }
            if (!choiceValidation.ok) {
                const payload = asRecord(action.payload);
                throw new game_errors_1.GameValidationError('Choix invalide.', {
                    gameType: 'mission-galaxie',
                    choiceIndex: Number(payload.choiceIndex),
                });
            }
            return choiceValidation.action;
        }
        if (pendingRow.type === 'choose_event_move') {
            if (type !== 'choose_event_move') {
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: 'mission-galaxie',
                });
            }
            const options = readEventMoveOptions(pending);
            const payload = asRecord(action.payload);
            const targetPlayerId = Number(payload.targetPlayerId);
            const delta = Number(payload.delta);
            if (!Number.isFinite(targetPlayerId) ||
                !Number.isFinite(delta) ||
                !options.some((opt) => opt.targetPlayerId === targetPlayerId && opt.delta === delta)) {
                throw new game_errors_1.GameValidationError('Choix invalide.', {
                    gameType: 'mission-galaxie',
                    targetPlayerId,
                    delta,
                });
            }
            return {
                type: 'choose_event_move',
                payload: { targetPlayerId, delta },
            };
        }
        throw new game_errors_1.PlayerActionError('Action non disponible.', {
            gameType: 'mission-galaxie',
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'mission-galaxie',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if (type === 'ROLL_DICE')
        return { type: 'roll', payload: {} };
    return { type, payload: action.payload ?? {} };
}
//# sourceMappingURL=rulebook.js.map