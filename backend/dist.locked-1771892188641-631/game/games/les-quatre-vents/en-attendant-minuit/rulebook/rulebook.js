"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const game_errors_1 = require("../../../../../common/errors/game-errors");
const minuit_definition_1 = require("../definitions/minuit.definition");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const pawn_pending_rulebook_helper_1 = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
const player_id_helper_1 = require("../../../../core/helpers/player-id.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
function asRecord(value) {
    return value && typeof value === 'object'
        ? value
        : {};
}
function toText(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
function getAvailableActions(state, playerId) {
    const status = String(state.status ?? '').toLowerCase();
    const pawnPending = state.pending;
    const pawnActions = (0, pawn_pending_rulebook_helper_1.getPendingPawnActionsForPlayer)(pawnPending, playerId, 'pick_pawn');
    if (pawnActions.length > 0) {
        return pawnActions;
    }
    if (status !== 'started')
        return [];
    const meta = (state.metadata ?? {});
    const pendingQuiz = meta.pendingQuiz ?? null;
    if (pendingQuiz) {
        if ((0, player_id_helper_1.toPlayerId)(pendingQuiz.playerId) !== playerId)
            return [];
        return (pendingQuiz.choices ?? []).map((choice) => ({
            type: 'answer_quiz',
            payload: { answer: choice },
        }));
    }
    const activePending = state.pending;
    if (activePending) {
        const drawActions = (0, pending_actions_rulebook_helper_1.getPendingDrawActionsForPlayer)(activePending, playerId, {
            samePlayer: (left, right) => (0, player_id_helper_1.toPlayerId)(left) === (0, player_id_helper_1.toPlayerId)(right),
        });
        if (drawActions.length > 0)
            return drawActions;
        const targetActions = (0, pending_actions_rulebook_helper_1.getPendingChooseTargetActionsForPlayer)(activePending, playerId, {
            samePlayer: (left, right) => (0, player_id_helper_1.toPlayerId)(left) === (0, player_id_helper_1.toPlayerId)(right),
        });
        if (targetActions.length > 0)
            return targetActions;
        return [];
    }
    const current = (0, player_id_helper_1.toPlayerId)(state.turn?.currentPlayerId ?? null);
    if (current !== playerId)
        return [];
    return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const type = (0, action_service_helper_1.normalizeLegacyRollAliasToUpper)(rawType);
    if (!minuit_definition_1.MINUIT_GAME.actions.includes(type)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'en-attendant-minuit',
            action: rawType,
            allowedActions: minuit_definition_1.MINUIT_GAME.actions,
        });
    }
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Acteur requis.', {
            gameType: 'en-attendant-minuit',
        });
    }
    const pickPawnPending = state.pending;
    if (pickPawnPending && pickPawnPending.type === 'pick_pawn') {
        const pawnValidation = (0, pawn_pending_rulebook_helper_1.validatePendingPawnActionForActor)({
            pending: pickPawnPending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            pendingType: 'pick_pawn',
        });
        if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'en-attendant-minuit',
            });
        }
        if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn') {
            throw new game_errors_1.GameValidationError('Choix de pion invalide.', {
                gameType: 'en-attendant-minuit',
                pawn: asRecord(action.payload).pawn ??
                    asRecord(action.payload).pawnId ??
                    asRecord(action.payload).value ??
                    null,
            });
        }
        if (!pawnValidation.ok) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'en-attendant-minuit',
            });
        }
        return pawnValidation.action;
    }
    if (!(0, rulebook_guard_helper_1.isStartedState)(state)) {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'en-attendant-minuit',
        });
    }
    const meta = (state.metadata ?? {});
    if (meta.pendingQuiz) {
        if (type !== 'answer_quiz') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'en-attendant-minuit',
                action: type,
            });
        }
        if ((0, player_id_helper_1.toPlayerId)(meta.pendingQuiz.playerId) !== actorId) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'en-attendant-minuit',
                expectedPlayerId: meta.pendingQuiz.playerId,
            });
        }
        const answer = toText(asRecord(action.payload).answer).trim();
        if (!answer) {
            throw new game_errors_1.GameValidationError('Payload invalide: answer', {
                gameType: 'en-attendant-minuit',
                payload: action.payload,
            });
        }
        return { type: 'answer_quiz', payload: { answer } };
    }
    const actionPending = state.pending;
    if (actionPending) {
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending: actionPending,
            actorId,
            actionType: type,
            samePlayer: (left, right) => (0, player_id_helper_1.toPlayerId)(left) === (0, player_id_helper_1.toPlayerId)(right),
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (actionPending.type === 'draw' &&
            drawValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: 'en-attendant-minuit',
                action: type,
            });
        }
        const targetValidation = (0, pending_actions_rulebook_helper_1.validatePendingChooseTargetActionForActor)({
            pending: actionPending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            samePlayer: (left, right) => (0, player_id_helper_1.toPlayerId)(left) === (0, player_id_helper_1.toPlayerId)(right),
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        if (actionPending.type === 'choose_target' &&
            targetValidation.reason === 'wrong_action_type') {
            throw new game_errors_1.PlayerActionError('Choix invalide.', {
                gameType: 'en-attendant-minuit',
            });
        }
        if (actionPending.type === 'choose_target' &&
            targetValidation.reason === 'invalid_target') {
            throw new game_errors_1.GameValidationError('Cible invalide.', {
                gameType: 'en-attendant-minuit',
                targetPlayerId: targetValidation.targetPlayerId,
            });
        }
        if ((0, player_id_helper_1.toPlayerId)(actionPending.playerId) !== actorId) {
            throw new game_errors_1.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'en-attendant-minuit',
            });
        }
        throw new game_errors_1.PlayerActionError('Action non disponible.', {
            gameType: 'en-attendant-minuit',
        });
    }
    const current = (0, player_id_helper_1.toPlayerId)(state.turn?.currentPlayerId ?? null);
    if (current != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'en-attendant-minuit',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if (type === 'ROLL_DICE')
        return { type: 'roll', payload: {} };
    return { type, payload: action.payload ?? {} };
}
//# sourceMappingURL=rulebook.js.map