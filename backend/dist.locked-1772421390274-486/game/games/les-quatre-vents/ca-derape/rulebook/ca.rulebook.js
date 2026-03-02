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
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
const _gameerrors = require("../../../../../common/errors/game-errors");
const _cadefinition = require("../definitions/ca.definition");
const _pendingactionsrulebookhelper = require("../../../../core/helpers/pending-actions-rulebook.helper");
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = state.pending;
    if (pending) {
        const drawActions = (0, _pendingactionsrulebookhelper.getPendingDrawActionsForPlayer)(pending, playerId);
        if (drawActions.length > 0) return drawActions;
        const targetActions = (0, _pendingactionsrulebookhelper.getPendingChooseTargetActionsForPlayer)(pending, playerId);
        if (targetActions.length > 0) return targetActions;
        if (pending.type === 'choose_next_player') {
            return (0, _pendingactionsrulebookhelper.getPendingNumberSetChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_next_player',
                actionType: 'choose_next_player',
                payloadValueKey: 'playerId',
                valuesKey: 'playerIds'
            });
        }
        if (pending.type === 'choose_next_delta') {
            return (0, _pendingactionsrulebookhelper.getPendingNumberSetChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_next_delta',
                actionType: 'choose_next_delta',
                payloadValueKey: 'delta',
                valuesKey: 'deltas'
            });
        }
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    return [
        {
            type: 'roll',
            payload: {}
        },
        {
            type: 'ROLL_DICE',
            payload: {}
        }
    ];
}
function validateAction(state, action, actorId) {
    const rawType = (0, _actionservicehelper.normalizeActionType)(action);
    const normalized = (0, _actionservicehelper.normalizeLegacyRollAliasToUpper)(rawType);
    if (!_cadefinition.CA_DERAPE_GAME.actions.includes(normalized)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'ca-derape',
            action: rawType,
            allowedActions: _cadefinition.CA_DERAPE_GAME.actions
        });
    }
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Acteur requis.', {
            gameType: 'ca-derape'
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'ca-derape'
        });
    }
    const pending = state.pending;
    if (pending) {
        const drawValidation = (0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: normalized
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pending.type === 'draw' && drawValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: 'ca-derape'
            });
        }
        const targetValidation = (0, _pendingactionsrulebookhelper.validatePendingChooseTargetActionForActor)({
            pending,
            actorId,
            actionType: normalized,
            payload: action.payload ?? {}
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        if (pending.type === 'choose_target' && targetValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Choix invalide.', {
                gameType: 'ca-derape'
            });
        }
        if (pending.type === 'choose_target' && targetValidation.reason === 'invalid_target') {
            throw new _gameerrors.GameValidationError('Cible invalide.', {
                gameType: 'ca-derape',
                targetPlayerId: targetValidation.targetPlayerId
            });
        }
        if (pending.playerId !== actorId) {
            throw new _gameerrors.PlayerActionError('Action réservée à un autre joueur.', {
                gameType: 'ca-derape'
            });
        }
        if (pending.type === 'choose_next_player') {
            const playerValidation = (0, _pendingactionsrulebookhelper.validatePendingNumberSetChoiceActionForActor)({
                pending,
                actorId,
                actionType: normalized,
                payload: action.payload ?? {},
                pendingType: 'choose_next_player',
                expectedActionType: 'choose_next_player',
                payloadValueKey: 'playerId',
                valuesKey: 'playerIds'
            });
            if (!playerValidation.ok && playerValidation.reason === 'wrong_action_type') {
                throw new _gameerrors.PlayerActionError('Choix invalide.', {
                    gameType: 'ca-derape'
                });
            }
            if (!playerValidation.ok) {
                const payload = asRecord(action.payload);
                throw new _gameerrors.GameValidationError('Joueur invalide.', {
                    gameType: 'ca-derape',
                    playerId: toNumber(payload.playerId)
                });
            }
            return playerValidation.action;
        }
        if (pending.type === 'choose_next_delta') {
            const deltaValidation = (0, _pendingactionsrulebookhelper.validatePendingNumberSetChoiceActionForActor)({
                pending,
                actorId,
                actionType: normalized,
                payload: action.payload ?? {},
                pendingType: 'choose_next_delta',
                expectedActionType: 'choose_next_delta',
                payloadValueKey: 'delta',
                valuesKey: 'deltas'
            });
            if (!deltaValidation.ok && deltaValidation.reason === 'wrong_action_type') {
                throw new _gameerrors.PlayerActionError('Choix invalide.', {
                    gameType: 'ca-derape'
                });
            }
            if (!deltaValidation.ok) {
                const payload = asRecord(action.payload);
                throw new _gameerrors.GameValidationError('Choix invalide.', {
                    gameType: 'ca-derape',
                    delta: toNumber(payload.delta)
                });
            }
            return deltaValidation.action;
        }
        throw new _gameerrors.PlayerActionError('Choix invalide.', {
            gameType: 'ca-derape'
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'ca-derape',
            playerId: actorId,
            currentPlayerId: current
        });
    }
    if ((0, _actionservicehelper.isRollActionType)(rawType)) {
        return {
            type: 'roll',
            payload: {}
        };
    }
    return {
        type: normalized,
        payload: action.payload ?? {}
    };
}
function asRecord(value) {
    if (value == null || typeof value !== 'object') return {};
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
