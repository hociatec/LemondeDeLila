"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const game_errors_1 = require("../../../../../common/errors/game-errors");
const frousse_definition_1 = require("../definitions/frousse.definition");
const pawns_utils_1 = require("../pawns.utils");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const pawn_pending_rulebook_helper_1 = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
const player_id_helper_1 = require("../../../../core/helpers/player-id.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawActions = (0, pending_actions_rulebook_helper_1.getPendingDrawActionsForPlayer)(pending, playerId, {
            samePlayer: (left, right) => (0, player_id_helper_1.toPlayerId)(left) === (0, player_id_helper_1.toPlayerId)(right),
        });
        if (drawActions.length > 0)
            return drawActions;
        const pawnActions = (0, pawn_pending_rulebook_helper_1.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        const targetActions = (0, pending_actions_rulebook_helper_1.getPendingChooseTargetActionsForPlayer)(pending, playerId, {
            samePlayer: (left, right) => (0, player_id_helper_1.toPlayerId)(left) === (0, player_id_helper_1.toPlayerId)(right),
        });
        if (targetActions.length > 0)
            return targetActions;
        return [];
    }
    const current = (0, player_id_helper_1.toPlayerId)(state.turn?.currentPlayerId ?? null);
    if (current == null || current !== playerId)
        return [];
    return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const type = (0, action_service_helper_1.normalizeLegacyRollAliasToUpper)(rawType);
    if (!frousse_definition_1.FROUSSE_GAME.actions.includes(type)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'frousse-party',
            action: rawType,
            allowedActions: frousse_definition_1.FROUSSE_GAME.actions,
        });
    }
    if (actorId == null)
        throw new game_errors_1.PlayerActionError('Acteur requis.', {
            gameType: 'frousse-party',
        });
    if (!(0, rulebook_guard_helper_1.isStartedState)(state)) {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'frousse-party',
        });
    }
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type,
            samePlayer: (left, right) => (0, player_id_helper_1.toPlayerId)(left) === (0, player_id_helper_1.toPlayerId)(right),
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pending.type === 'draw' &&
            drawValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'frousse-party',
            });
        }
        const pendingType = toText(pending.type);
        if (pendingType === 'choose_pawn') {
            const pawnValidation = (0, pawn_pending_rulebook_helper_1.validatePendingPawnActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_pawn',
                idResolver: (value) => String((0, pawns_utils_1.resolvePawnId)(value) ?? '').trim(),
            });
            if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type') {
                throw new game_errors_1.PlayerActionError('Choix invalide.', {
                    gameType: 'frousse-party',
                });
            }
            if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn') {
                throw new game_errors_1.GameValidationError('Pion invalide.', {
                    gameType: 'frousse-party',
                    pawnId: asRecord(action.payload).pawnId ??
                        asRecord(action.payload).pawn ??
                        asRecord(action.payload).value ??
                        null,
                });
            }
            if (!pawnValidation.ok) {
                throw new game_errors_1.PlayerActionError('Choix invalide.', {
                    gameType: 'frousse-party',
                });
            }
            return pawnValidation.action;
        }
        const targetValidation = (0, pending_actions_rulebook_helper_1.validatePendingChooseTargetActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            samePlayer: (left, right) => (0, player_id_helper_1.toPlayerId)(left) === (0, player_id_helper_1.toPlayerId)(right),
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        if (pendingType === 'choose_target' &&
            targetValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Choix invalide.', {
                gameType: 'frousse-party',
            });
        }
        if (pendingType === 'choose_target' &&
            targetValidation.reason === 'invalid_target') {
            throw new game_errors_1.GameValidationError('Cible invalide.', {
                gameType: 'frousse-party',
                targetPlayerId: targetValidation.targetPlayerId,
            });
        }
        const pendingPlayerId = (0, player_id_helper_1.toPlayerId)(pending.playerId);
        if (pendingPlayerId == null || pendingPlayerId !== actorId) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'frousse-party',
            });
        }
        throw new game_errors_1.PlayerActionError('Action non disponible.', {
            gameType: 'frousse-party',
        });
    }
    const current = (0, player_id_helper_1.toPlayerId)(state.turn?.currentPlayerId ?? null);
    if (current != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'frousse-party',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if (type === 'ROLL_DICE')
        return { type: 'roll', payload: {} };
    return { type, payload: action.payload ?? {} };
}
function asRecord(value) {
    return value && typeof value === 'object'
        ? value
        : {};
}
function toText(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    return '';
}
function asPendingRecord(value) {
    if (!value || typeof value !== 'object')
        return null;
    return value;
}
//# sourceMappingURL=rulebook.js.map