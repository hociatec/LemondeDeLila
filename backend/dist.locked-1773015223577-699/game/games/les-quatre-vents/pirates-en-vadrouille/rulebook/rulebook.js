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
const _gameerrors = require("../../../../../common/errors/game-errors");
const _piratesenvadrouilledefinition = require("../definitions/pirates-en-vadrouille.definition");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
const _pendingactionsrulebookhelper = require("../../../../core/helpers/pending-actions-rulebook.helper");
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function isPiratesActionType(value) {
    return _piratesenvadrouilledefinition.PIRATES_GAME.actions.includes(value);
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = state.pending;
    if (pending) {
        const targetActions = (0, _pendingactionsrulebookhelper.getPendingChooseTargetActionsForPlayer)(pending, playerId, {
            targetsKey: 'options'
        });
        if (targetActions.length > 0) return targetActions;
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
    const normalizedType = (0, _actionservicehelper.normalizeActionType)(action);
    const rawType = typeof normalizedType === 'string' ? normalizedType : '';
    const maybeType = (0, _actionservicehelper.isRollAlias)(rawType) ? 'roll' : rawType;
    if (!isPiratesActionType(maybeType)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'pirates-en-vadrouille',
            action: rawType,
            allowedActions: _piratesenvadrouilledefinition.PIRATES_GAME.actions
        });
    }
    const type = maybeType;
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Acteur requis.', {
            gameType: 'pirates-en-vadrouille'
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'pirates-en-vadrouille'
        });
    }
    const pending = state.pending;
    if (pending) {
        const targetValidation = (0, _pendingactionsrulebookhelper.validatePendingChooseTargetActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            targetsKey: 'options'
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        const pendingRow = asRecord(pending);
        if (pendingRow.type === 'choose_target' && targetValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: 'pirates-en-vadrouille'
            });
        }
        if (pendingRow.type === 'choose_target' && targetValidation.reason === 'invalid_target') {
            throw new _gameerrors.GameValidationError('Cible invalide.', {
                gameType: 'pirates-en-vadrouille',
                targetPlayerId: targetValidation.targetPlayerId
            });
        }
        if (Number(pendingRow.playerId ?? null) !== actorId) {
            throw new _gameerrors.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'pirates-en-vadrouille'
            });
        }
        throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: 'pirates-en-vadrouille'
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'pirates-en-vadrouille',
            playerId: actorId,
            currentPlayerId: current
        });
    }
    if (type === 'roll') return {
        type: 'roll',
        payload: action.payload ?? {}
    };
    return action;
}
