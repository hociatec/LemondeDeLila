"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get getAvailableActions () {
        return getAvailableActions;
    },
    get validateAction () {
        return validateAction;
    }
});
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _pawnpendingrulebookhelper = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const _pendingactionsrulebookhelper = require("../../../../core/helpers/pending-actions-rulebook.helper");
const _gameerrors = require("../../../../../common/errors/game-errors");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
const GAME_TYPE = 'contes-et-cacahuetes';
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = asPendingRecord(state.pending);
    if (pending) {
        if (Number(pending.playerId) !== playerId) return [];
        const drawActions = (0, _pendingactionsrulebookhelper.getPendingDrawActionsForPlayer)(pending, playerId);
        if (drawActions.length > 0) return drawActions;
        const type = toText(pending.type).toLowerCase();
        if (type === 'choose_pawn') {
            return (0, _pawnpendingrulebookhelper.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        }
        if (type === 'reroll') {
            return [
                {
                    type: 'reroll_yes',
                    payload: {}
                },
                {
                    type: 'reroll_no',
                    payload: {}
                }
            ];
        }
        const targetActions = (0, _pendingactionsrulebookhelper.getPendingChooseTargetActionsForPlayer)(pending, playerId);
        if (targetActions.length > 0) return targetActions;
        if (type === 'choose_number') {
            return (0, _pendingactionsrulebookhelper.getPendingNumberChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_number',
                actionType: 'choose_number',
                payloadValueKey: 'value',
                minKey: 'min',
                maxKey: 'max',
                defaultMin: 1,
                defaultMax: 3
            });
        }
        if (type === 'choose_option') {
            return (0, _pendingactionsrulebookhelper.getPendingStringChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_option',
                actionType: 'choose_option',
                payloadOptionKey: 'option',
                choicesContainer: 'root',
                choicesKey: 'choices'
            });
        }
        if (type === 'choose_card') {
            return (0, _pendingactionsrulebookhelper.getPendingCardChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_card',
                actionType: 'choose_card',
                cardsKey: 'cards',
                payloadCardTypeKey: 'cardType',
                payloadCardIdKey: 'cardId'
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
    if (current !== playerId) return [];
    return [
        {
            type: 'roll',
            payload: {}
        }
    ];
}
function validateAction(state, action, actorId) {
    const type = (0, _actionservicehelper.normalizeActionType)(action);
    const isRoll = (0, _actionservicehelper.isRollActionType)(type);
    if (!isRoll && type !== 'reroll_yes' && type !== 'reroll_no' && type !== 'choose_target' && type !== 'choose_number' && type !== 'choose_option' && type !== 'choose_card' && type !== 'choose_pawn' && type !== 'draw') {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${type}`, {
            gameType: GAME_TYPE,
            action: {
                type
            }
        });
    }
    if (actorId == null) throw new _gameerrors.PlayerActionError('Acteur requis.', {
        gameType: GAME_TYPE
    });
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
        gameType: GAME_TYPE
    });
    const pending = asPendingRecord(state.pending);
    if (pending) {
        if (Number(pending.playerId) !== actorId) throw new _gameerrors.PlayerActionError('Action réservée à un autre joueur.', {
            gameType: GAME_TYPE
        });
        const pType = toText(pending.type).toLowerCase();
        const drawValidation = (0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pType === 'draw' && drawValidation.reason === 'wrong_action_type') throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: GAME_TYPE
        });
        if (pType === 'choose_pawn') {
            const pawnValidation = (0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_pawn'
            });
            if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type') throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
            if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn') throw new _gameerrors.GameValidationError('Pion invalide.', {
                gameType: GAME_TYPE,
                action: {
                    type,
                    payload: action.payload ?? null
                }
            });
            if (!pawnValidation.ok) throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
            return pawnValidation.action;
        }
        if (pType === 'reroll') {
            if (type !== 'reroll_yes' && type !== 'reroll_no') throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
            return {
                type,
                payload: {}
            };
        }
        const targetValidation = (0, _pendingactionsrulebookhelper.validatePendingChooseTargetActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {}
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        if (pType === 'choose_target' && targetValidation.reason === 'wrong_action_type') throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: GAME_TYPE
        });
        if (pType === 'choose_target' && targetValidation.reason === 'invalid_target') throw new _gameerrors.GameValidationError('Cible invalide.', {
            gameType: GAME_TYPE,
            action: {
                type,
                payload: action.payload ?? null
            }
        });
        if (pType === 'choose_number') {
            const numberValidation = (0, _pendingactionsrulebookhelper.validatePendingNumberChoiceActionForActor)({
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
                defaultMax: 3
            });
            if (!numberValidation.ok && numberValidation.reason === 'wrong_action_type') throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
            if (!numberValidation.ok) throw new _gameerrors.GameValidationError('Valeur invalide.', {
                gameType: GAME_TYPE,
                action: {
                    type,
                    payload: action.payload ?? null
                }
            });
            return numberValidation.action;
        }
        if (pType === 'choose_option') {
            const optionValidation = (0, _pendingactionsrulebookhelper.validatePendingStringChoiceActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_option',
                expectedActionType: 'choose_option',
                payloadOptionKey: 'option',
                choicesContainer: 'root',
                choicesKey: 'choices'
            });
            if (!optionValidation.ok && optionValidation.reason === 'wrong_action_type') throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
            if (!optionValidation.ok) throw new _gameerrors.GameValidationError('Option invalide.', {
                gameType: GAME_TYPE,
                action: {
                    type,
                    payload: action.payload ?? null
                }
            });
            return optionValidation.action;
        }
        if (pType === 'choose_card') {
            const cardValidation = (0, _pendingactionsrulebookhelper.validatePendingCardChoiceActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_card',
                expectedActionType: 'choose_card',
                cardsKey: 'cards',
                payloadCardTypeKey: 'cardType',
                payloadCardIdKey: 'cardId'
            });
            if (!cardValidation.ok && cardValidation.reason === 'wrong_action_type') throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
            if (!cardValidation.ok) {
                throw new _gameerrors.GameValidationError('Carte invalide.', {
                    gameType: GAME_TYPE,
                    action: {
                        type,
                        payload: action.payload ?? null
                    }
                });
            }
            return cardValidation.action;
        }
        throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: GAME_TYPE
        });
    }
    const meta = asRecord(state.metadata);
    const blockedUntilPassed = asRecord(asRecord(meta.statuses).blockedUntilPassed) ?? {};
    if (typeof blockedUntilPassed[actorId] === 'number') {
        throw new _gameerrors.PlayerActionError('Vous êtes bloqué(e) : attendez qu’un autre joueur vous dépasse.', {
            gameType: GAME_TYPE
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
        gameType: GAME_TYPE
    });
    return {
        type: 'roll',
        payload: {}
    };
}
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function toText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
}
function asPendingRecord(value) {
    if (!value || typeof value !== 'object') return null;
    return value;
}
