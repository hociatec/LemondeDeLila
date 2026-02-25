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
const _monvillagedefinition = require("../definitions/mon-village.definition");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    if (state.pending) return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) {
        return [];
    }
    return [
        {
            type: 'roll',
            payload: {}
        }
    ];
}
function validateAction(state, action, actorId) {
    const rawType = (0, _actionservicehelper.normalizeActionType)(action);
    const type = (0, _actionservicehelper.normalizeRollActionType)(rawType);
    if (!_monvillagedefinition.MON_VILLAGE_GAME.actions.includes(type)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'mon-village-mon-histoire',
            action: rawType,
            allowedActions: _monvillagedefinition.MON_VILLAGE_GAME.actions
        });
    }
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Acteur requis.', {
            gameType: 'mon-village-mon-histoire'
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'mon-village-mon-histoire'
        });
    }
    if (state.pending) {
        throw new _gameerrors.PlayerActionError('Action indisponible (choix en attente).', {
            gameType: 'mon-village-mon-histoire'
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'mon-village-mon-histoire',
            playerId: actorId,
            currentPlayerId: current
        });
    }
    return {
        type: 'roll',
        payload: {}
    };
}
