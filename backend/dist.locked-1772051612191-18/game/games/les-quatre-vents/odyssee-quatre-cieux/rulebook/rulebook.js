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
const _odysseedefinition = require("../definitions/odyssee.definition");
const _pendingpawnmoverulebookhelper = require("../../../../core/helpers/pending-pawn-move-rulebook.helper");
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = state.pending;
    if (pending) {
        const pendingMoveActions = (0, _pendingpawnmoverulebookhelper.getPendingPawnMoveActionsForPlayer)(pending, playerId, 'choose_pawn', 'move_pawn');
        if (pendingMoveActions.length > 0) {
            return pendingMoveActions;
        }
        const pendingRow = asRecord(pending);
        if (Number(pendingRow.playerId ?? null) !== playerId) return [];
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
    if (!_odysseedefinition.ODYSSEE_GAME.actions.includes(type)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'odyssee-quatre-cieux',
            action: rawType,
            allowedActions: _odysseedefinition.ODYSSEE_GAME.actions
        });
    }
    if (actorId == null) throw new _gameerrors.PlayerActionError('Acteur requis.', {
        gameType: 'odyssee-quatre-cieux'
    });
    if (!(0, _rulebookguardhelper.isStartedState)(state)) {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'odyssee-quatre-cieux'
        });
    }
    const pending = state.pending;
    if (pending) {
        const moveValidation = (0, _pendingpawnmoverulebookhelper.validatePendingPawnMoveActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn',
            expectedActionType: 'move_pawn'
        });
        if (!moveValidation.ok && moveValidation.reason === 'not_pending_for_actor') throw new _gameerrors.PlayerActionError("Ce n'est pas votre action.", {
            gameType: 'odyssee-quatre-cieux'
        });
        if (!moveValidation.ok && moveValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: 'odyssee-quatre-cieux'
            });
        }
        if (!moveValidation.ok) {
            throw new _gameerrors.GameValidationError('Payload invalide.', {
                gameType: 'odyssee-quatre-cieux',
                payload: action.payload
            });
        }
        return moveValidation.action;
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'odyssee-quatre-cieux',
            playerId: actorId,
            currentPlayerId: current
        });
    }
    if (type === 'ROLL_DICE') return {
        type: 'roll',
        payload: {}
    };
    return {
        type: 'roll',
        payload: {}
    };
}
