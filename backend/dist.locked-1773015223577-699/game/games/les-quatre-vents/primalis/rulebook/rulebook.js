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
const _primalisdefinition = require("../definitions/primalis.definition");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function isPrimalisActionType(value) {
    return _primalisdefinition.PRIMALIS_GAME.actions.includes(value);
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.canPlayerActOnTurn)(state, playerId)) return [];
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
    if (!isPrimalisActionType(maybeType)) {
        throw new _gameerrors.PlayerActionError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'primalis'
        });
    }
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Acteur requis.', {
            gameType: 'primalis'
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'primalis'
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'primalis',
            playerId: actorId,
            currentPlayerId: current
        });
    }
    return {
        type: 'roll',
        payload: {}
    };
}
