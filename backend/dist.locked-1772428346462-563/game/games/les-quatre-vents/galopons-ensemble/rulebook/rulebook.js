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
const _galoponsdefinition = require("../definitions/galopons.definition");
const _pendingactionsrulebookhelper = require("../../../../core/helpers/pending-actions-rulebook.helper");
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = state.pending;
    if (pending) {
        const drawActions = (0, _pendingactionsrulebookhelper.getPendingDrawActionsForPlayer)(pending, playerId);
        if (drawActions.length > 0) return drawActions;
        const targetActions = (0, _pendingactionsrulebookhelper.getPendingChooseTargetActionsForPlayer)(pending, playerId);
        if (targetActions.length > 0) return targetActions;
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    return [
        {
            type: 'roll'
        },
        {
            type: 'ROLL_DICE'
        }
    ];
}
function validateAction(state, action, actorId) {
    const rawType = (0, _actionservicehelper.normalizeActionType)(action);
    const type = (0, _actionservicehelper.normalizeLegacyRollAliasToUpper)(rawType);
    if (!_galoponsdefinition.GALOPONS_GAME.actions.includes(type)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'galopons-ensemble',
            action: rawType,
            allowedActions: _galoponsdefinition.GALOPONS_GAME.actions
        });
    }
    if (actorId == null) throw new _gameerrors.PlayerActionError('Acteur requis.', {
        gameType: 'galopons-ensemble'
    });
    if (!(0, _rulebookguardhelper.isStartedState)(state)) {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'galopons-ensemble'
        });
    }
    const pending = state.pending;
    if (pending) {
        const drawValidation = (0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        const pendingRow = asRecord(pending);
        if (pendingRow.type === 'draw' && drawValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: 'galopons-ensemble'
            });
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
        if (pendingRow.type === 'choose_target' && targetValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Choix invalide.', {
                gameType: 'galopons-ensemble'
            });
        }
        if (pendingRow.type === 'choose_target' && targetValidation.reason === 'invalid_target') {
            throw new _gameerrors.GameValidationError('Cible invalide.', {
                gameType: 'galopons-ensemble',
                targetPlayerId: targetValidation.targetPlayerId
            });
        }
        if (Number(pendingRow.playerId ?? null) !== actorId) {
            throw new _gameerrors.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'galopons-ensemble'
            });
        }
        throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: 'galopons-ensemble'
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'galopons-ensemble',
            playerId: actorId,
            currentPlayerId: current
        });
    }
    if (type === 'ROLL_DICE') return {
        type: 'roll',
        payload: {}
    };
    return {
        type,
        payload: action.payload ?? {}
    };
}
