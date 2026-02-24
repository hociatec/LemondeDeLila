"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
const ALLOWED = new Set([
    'roll',
    'ROLL_DICE',
    'roll_dice',
    'draw',
    'answer_quiz',
    'choose_target',
]);
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = state.pending;
    const drawActions = (0, pending_actions_rulebook_helper_1.getPendingDrawActionsForPlayer)(pending, playerId);
    if (drawActions.length > 0)
        return drawActions;
    if (pending?.type === 'quiz') {
        if ((pending.playerId ?? null) !== playerId)
            return [];
        return [{ type: 'answer_quiz', payload: {} }];
    }
    if (pending?.type === 'choose_target') {
        const chooseTargetActions = (0, pending_actions_rulebook_helper_1.getPendingChooseTargetActionsForPlayer)(pending, playerId);
        if (chooseTargetActions.length > 0)
            return chooseTargetActions;
        return [];
    }
    if ((state.turn?.currentPlayerId ?? null) !== playerId)
        return [];
    return [{ type: 'roll', payload: {} }];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const normalized = rawType.toLowerCase();
    if (!ALLOWED.has(rawType) && !ALLOWED.has(normalized)) {
        throw new game_errors_1.GameValidationError(`Action type not allowed: ${rawType || '(empty)'}`, {
            gameType: 'voyage-en-terre-de-brumes',
            action: rawType,
            allowedActions: Array.from(ALLOWED),
        });
    }
    const pending = state.pending;
    if (pending?.type) {
        const pid = pending.playerId ?? null;
        if (pid != null && actorId != null && actorId !== pid) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'voyage-en-terre-de-brumes',
                playerId: actorId,
                currentPlayerId: pid,
            });
        }
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending,
            actorId: Number(actorId ?? NaN),
            actionType: normalized,
            samePlayer: (left, right) => Number.isFinite(right) && Number(left) === Number(right),
        });
        if (drawValidation.ok)
            return drawValidation.action;
        if (pending.type === 'draw' &&
            drawValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'voyage-en-terre-de-brumes',
                action: rawType,
            });
        }
        if (pending.type === 'quiz')
            return action.type === 'answer_quiz'
                ? action
                : { ...action, type: 'answer_quiz' };
        if (pending.type === 'choose_target') {
            const targetValidation = (0, pending_actions_rulebook_helper_1.validatePendingChooseTargetActionForActor)({
                pending,
                actorId: Number(actorId ?? NaN),
                actionType: normalized,
                payload: action.payload ?? {},
                samePlayer: (left, right) => Number.isFinite(right) && Number(left) === Number(right),
            });
            if (targetValidation.ok)
                return targetValidation.action;
            if (targetValidation.reason === 'wrong_action_type') {
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: 'voyage-en-terre-de-brumes',
                    action: rawType,
                });
            }
            if (targetValidation.reason === 'invalid_target') {
                throw new game_errors_1.GameValidationError('Cible invalide.', {
                    gameType: 'voyage-en-terre-de-brumes',
                    payload: action.payload ?? null,
                });
            }
        }
        throw new game_errors_1.PlayerActionError('Action non disponible.', {
            gameType: 'voyage-en-terre-de-brumes',
            action: rawType,
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'voyage-en-terre-de-brumes',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if ((0, action_service_helper_1.isRollAlias)(rawType, normalized)) {
        return { ...action, type: 'roll', payload: {} };
    }
    if (normalized === 'draw')
        return { ...action, type: 'draw', payload: {} };
    if (normalized === 'answer_quiz')
        return action;
    if (normalized === 'choose_target')
        return action;
    return { ...action, type: 'roll', payload: {} };
}
//# sourceMappingURL=rulebook.js.map