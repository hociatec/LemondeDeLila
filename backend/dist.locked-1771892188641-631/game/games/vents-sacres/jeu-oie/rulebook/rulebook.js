"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const pawn_pending_rulebook_helper_1 = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const ALLOWED = new Set(['roll', 'ROLL_DICE', 'roll_dice', 'choose_pawn']);
function samePlayerId(a, b) {
    const left = Number(a);
    const right = Number(b);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = state.pending;
    if (pending) {
        const pawnActions = (0, pawn_pending_rulebook_helper_1.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        return [];
    }
    if (!samePlayerId(state.turn?.currentPlayerId ?? null, playerId))
        return [];
    return [{ type: 'roll', payload: {} }];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const normalized = rawType.toLowerCase();
    if (!ALLOWED.has(rawType) && !ALLOWED.has(normalized)) {
        throw new game_errors_1.GameValidationError(`Action type not allowed: ${rawType || '(empty)'}`, {
            gameType: 'jeu-oie',
            action: rawType,
            allowedActions: Array.from(ALLOWED),
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new game_errors_1.GameValidationError("La partie n'est pas demarree.", {
            gameType: 'jeu-oie',
            action: rawType,
        });
    }
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Acteur requis.', { gameType: 'jeu-oie' });
    }
    const pending = state.pending;
    if (pending) {
        const pawnValidation = (0, pawn_pending_rulebook_helper_1.validatePendingPawnActionForActor)({
            pending,
            actorId,
            actionType: normalized,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn',
        });
        if (pawnValidation.ok) {
            return pawnValidation.action;
        }
        if (pawnValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action indisponible (choix de pion requis).', { gameType: 'jeu-oie', playerId: actorId });
        }
        if (pawnValidation.reason === 'invalid_pawn') {
            throw new game_errors_1.PlayerActionError('Pion invalide.', {
                gameType: 'jeu-oie',
                playerId: actorId,
            });
        }
        throw new game_errors_1.PlayerActionError('Action indisponible (choix en attente).', {
            gameType: 'jeu-oie',
            playerId: actorId,
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, actorId)) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'jeu-oie',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if ((0, action_service_helper_1.isRollAlias)(rawType, normalized)) {
        return { ...action, type: 'roll', payload: {} };
    }
    return { ...action, type: 'roll', payload: {} };
}
//# sourceMappingURL=rulebook.js.map