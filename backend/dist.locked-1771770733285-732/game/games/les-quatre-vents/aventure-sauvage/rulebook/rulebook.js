"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const aventure_sauvage_pawns_1 = require("../aventure-sauvage.pawns");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const pawn_pending_rulebook_helper_1 = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const GAME_TYPE = 'aventure-sauvage';
function samePlayerId(a, b) {
    const left = Number(a);
    const right = Number(b);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawActions = (0, pending_actions_rulebook_helper_1.getPendingDrawActionsForPlayer)(pending, playerId, {
            samePlayer: samePlayerId,
        });
        if (drawActions.length > 0)
            return drawActions;
        const pawnActions = (0, pawn_pending_rulebook_helper_1.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, playerId))
        return [];
    return [{ type: 'roll', payload: {} }];
}
function validateAction(state, action, actorId) {
    const type = (0, action_service_helper_1.normalizeActionType)(action);
    const isRoll = (0, action_service_helper_1.isRollActionType)(type);
    if (!isRoll && type !== 'draw' && type !== 'choose_pawn') {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${type}`, {
            gameType: GAME_TYPE,
            action: { type },
        });
    }
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Acteur requis.', { gameType: GAME_TYPE });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new game_errors_1.PlayerActionError("La partie n'est pas demarree.", {
            gameType: GAME_TYPE,
        });
    }
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type,
            samePlayer: samePlayerId,
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pending.type === 'draw' &&
            drawValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE,
            });
        }
        const pawnValidation = (0, pawn_pending_rulebook_helper_1.validatePendingPawnActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn',
            idResolver: (value) => String((0, aventure_sauvage_pawns_1.resolvePawnId)(value) ?? '').trim(),
        });
        if (pawnValidation.ok) {
            return pawnValidation.action;
        }
        if (pawnValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE,
            });
        }
        if (pawnValidation.reason === 'invalid_pawn') {
            throw new game_errors_1.GameValidationError('Pion invalide.', {
                gameType: GAME_TYPE,
                action: { type, payload: action.payload ?? null },
            });
        }
        throw new game_errors_1.PlayerActionError('Action non disponible.', {
            gameType: GAME_TYPE,
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, actorId)) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: GAME_TYPE,
        });
    }
    return { type: 'roll', payload: {} };
}
function asRecord(value) {
    return value && typeof value === 'object'
        ? value
        : {};
}
function asPendingRecord(value) {
    if (!value || typeof value !== 'object')
        return null;
    const record = asRecord(value);
    return {
        type: toText(record.type),
        playerId: record.playerId,
        data: asRecord(record.data),
    };
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
//# sourceMappingURL=rulebook.js.map