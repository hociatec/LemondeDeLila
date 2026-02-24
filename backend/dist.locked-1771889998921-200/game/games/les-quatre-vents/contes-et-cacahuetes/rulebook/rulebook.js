"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const pawn_pending_rulebook_helper_1 = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const pending_actions_rulebook_helper_1 = require("../../../../core/helpers/pending-actions-rulebook.helper");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const GAME_TYPE = 'contes-et-cacahuetes';
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = asPendingRecord(state.pending);
    if (pending) {
        if (Number(pending.playerId) !== playerId)
            return [];
        const drawActions = (0, pending_actions_rulebook_helper_1.getPendingDrawActionsForPlayer)(pending, playerId);
        if (drawActions.length > 0)
            return drawActions;
        const type = toText(pending.type).toLowerCase();
        if (type === 'choose_pawn') {
            return (0, pawn_pending_rulebook_helper_1.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        }
        if (type === 'reroll') {
            return [
                { type: 'reroll_yes', payload: {} },
                { type: 'reroll_no', payload: {} },
            ];
        }
        const targetActions = (0, pending_actions_rulebook_helper_1.getPendingChooseTargetActionsForPlayer)(pending, playerId);
        if (targetActions.length > 0)
            return targetActions;
        if (type === 'choose_number') {
            return (0, pending_actions_rulebook_helper_1.getPendingNumberChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_number',
                actionType: 'choose_number',
                payloadValueKey: 'value',
                minKey: 'min',
                maxKey: 'max',
                defaultMin: 1,
                defaultMax: 3,
            });
        }
        if (type === 'choose_option') {
            return (0, pending_actions_rulebook_helper_1.getPendingStringChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_option',
                actionType: 'choose_option',
                payloadOptionKey: 'option',
                choicesContainer: 'root',
                choicesKey: 'choices',
            });
        }
        if (type === 'choose_card') {
            return (0, pending_actions_rulebook_helper_1.getPendingCardChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_card',
                actionType: 'choose_card',
                cardsKey: 'cards',
                payloadCardTypeKey: 'cardType',
                payloadCardIdKey: 'cardId',
            });
        }
        return [];
    }
    const meta = asRecord(state.metadata);
    const blockedUntilPassed = asRecord(asRecord(meta.statuses).blockedUntilPassed) ?? {};
    if (typeof blockedUntilPassed[playerId] === 'number') {
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    return [{ type: 'roll', payload: {} }];
}
function validateAction(state, action, actorId) {
    const type = (0, action_service_helper_1.normalizeActionType)(action);
    const isRoll = (0, action_service_helper_1.isRollActionType)(type);
    if (!isRoll &&
        type !== 'reroll_yes' &&
        type !== 'reroll_no' &&
        type !== 'choose_target' &&
        type !== 'choose_number' &&
        type !== 'choose_option' &&
        type !== 'choose_card' &&
        type !== 'choose_pawn' &&
        type !== 'draw') {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${type}`, {
            gameType: GAME_TYPE,
            action: { type },
        });
    }
    if (actorId == null)
        throw new game_errors_1.PlayerActionError('Acteur requis.', { gameType: GAME_TYPE });
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started')
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: GAME_TYPE,
        });
    const pending = asPendingRecord(state.pending);
    if (pending) {
        if (Number(pending.playerId) !== actorId)
            throw new game_errors_1.PlayerActionError('Action réservée à un autre joueur.', {
                gameType: GAME_TYPE,
            });
        const pType = toText(pending.type).toLowerCase();
        const drawValidation = (0, pending_actions_rulebook_helper_1.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type,
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pType === 'draw' && drawValidation.reason === 'wrong_action_type')
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE,
            });
        if (pType === 'choose_pawn') {
            const pawnValidation = (0, pawn_pending_rulebook_helper_1.validatePendingPawnActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_pawn',
            });
            if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type')
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: GAME_TYPE,
                });
            if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn')
                throw new game_errors_1.GameValidationError('Pion invalide.', {
                    gameType: GAME_TYPE,
                    action: { type, payload: action.payload ?? null },
                });
            if (!pawnValidation.ok)
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: GAME_TYPE,
                });
            return pawnValidation.action;
        }
        if (pType === 'reroll') {
            if (type !== 'reroll_yes' && type !== 'reroll_no')
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: GAME_TYPE,
                });
            return { type, payload: {} };
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
        if (pType === 'choose_target' &&
            targetValidation.reason === 'wrong_action_type')
            throw new game_errors_1.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE,
            });
        if (pType === 'choose_target' &&
            targetValidation.reason === 'invalid_target')
            throw new game_errors_1.GameValidationError('Cible invalide.', {
                gameType: GAME_TYPE,
                action: { type, payload: action.payload ?? null },
            });
        if (pType === 'choose_number') {
            const numberValidation = (0, pending_actions_rulebook_helper_1.validatePendingNumberChoiceActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_number',
                expectedActionType: 'choose_number',
                payloadValueKey: 'value',
                minKey: 'min',
                maxKey: 'max',
                defaultMin: 1,
                defaultMax: 3,
            });
            if (!numberValidation.ok &&
                numberValidation.reason === 'wrong_action_type')
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: GAME_TYPE,
                });
            if (!numberValidation.ok)
                throw new game_errors_1.GameValidationError('Valeur invalide.', {
                    gameType: GAME_TYPE,
                    action: { type, payload: action.payload ?? null },
                });
            return numberValidation.action;
        }
        if (pType === 'choose_option') {
            const optionValidation = (0, pending_actions_rulebook_helper_1.validatePendingStringChoiceActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_option',
                expectedActionType: 'choose_option',
                payloadOptionKey: 'option',
                choicesContainer: 'root',
                choicesKey: 'choices',
            });
            if (!optionValidation.ok &&
                optionValidation.reason === 'wrong_action_type')
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: GAME_TYPE,
                });
            if (!optionValidation.ok)
                throw new game_errors_1.GameValidationError('Option invalide.', {
                    gameType: GAME_TYPE,
                    action: { type, payload: action.payload ?? null },
                });
            return optionValidation.action;
        }
        if (pType === 'choose_card') {
            const cardValidation = (0, pending_actions_rulebook_helper_1.validatePendingCardChoiceActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_card',
                expectedActionType: 'choose_card',
                cardsKey: 'cards',
                payloadCardTypeKey: 'cardType',
                payloadCardIdKey: 'cardId',
            });
            if (!cardValidation.ok && cardValidation.reason === 'wrong_action_type')
                throw new game_errors_1.PlayerActionError('Action non disponible.', {
                    gameType: GAME_TYPE,
                });
            if (!cardValidation.ok) {
                throw new game_errors_1.GameValidationError('Carte invalide.', {
                    gameType: GAME_TYPE,
                    action: { type, payload: action.payload ?? null },
                });
            }
            return cardValidation.action;
        }
        throw new game_errors_1.PlayerActionError('Action non disponible.', {
            gameType: GAME_TYPE,
        });
    }
    const meta = asRecord(state.metadata);
    const blockedUntilPassed = asRecord(asRecord(meta.statuses).blockedUntilPassed) ?? {};
    if (typeof blockedUntilPassed[actorId] === 'number') {
        throw new game_errors_1.PlayerActionError('Vous êtes bloqué(e) : attendez qu’un autre joueur vous dépasse.', { gameType: GAME_TYPE });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId)
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: GAME_TYPE,
        });
    return { type: 'roll', payload: {} };
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