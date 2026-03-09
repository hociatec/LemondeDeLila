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
const _toutpresdemamandefinition = require("../definitions/tout-pres-de-maman.definition");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
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
    const rawType = (0, _actionservicehelper.normalizeActionType)(action);
    const type = (0, _actionservicehelper.normalizeRollActionType)(rawType);
    if (!_toutpresdemamandefinition.TOUT_PRES_DE_MAMAN_GAME.actions.includes(type)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: _toutpresdemamandefinition.TOUT_PRES_DE_MAMAN_GAME.id,
            action: rawType,
            allowedActions: _toutpresdemamandefinition.TOUT_PRES_DE_MAMAN_GAME.actions
        });
    }
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Acteur requis.', {
            gameType: _toutpresdemamandefinition.TOUT_PRES_DE_MAMAN_GAME.id
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: _toutpresdemamandefinition.TOUT_PRES_DE_MAMAN_GAME.id
        });
    }
    if (state.pending) {
        throw new _gameerrors.PlayerActionError('Action indisponible (choix en attente).', {
            gameType: _toutpresdemamandefinition.TOUT_PRES_DE_MAMAN_GAME.id
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: _toutpresdemamandefinition.TOUT_PRES_DE_MAMAN_GAME.id,
            playerId: actorId,
            currentPlayerId: current
        });
    }
    return {
        type: 'roll',
        payload: {}
    };
}
