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
const _pawnpendingrulebookhelper = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const _gameerrors = require("../../../../../common/errors/game-errors");
const ALLOWED = new Set([
    'roll',
    'ROLL_DICE',
    'roll_dice',
    'choose_pawn'
]);
function samePlayerId(a, b) {
    const left = Number(a);
    const right = Number(b);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = state.pending;
    if (pending) {
        const pawnActions = (0, _pawnpendingrulebookhelper.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        return [];
    }
    if (!samePlayerId(state.turn?.currentPlayerId ?? null, playerId)) return [];
    return [
        {
            type: 'roll',
            payload: {}
        }
    ];
}
function validateAction(state, action, actorId) {
    const rawType = (0, _actionservicehelper.normalizeActionType)(action);
    const normalized = rawType.toLowerCase();
    if (!ALLOWED.has(rawType) && !ALLOWED.has(normalized)) {
        throw new _gameerrors.GameValidationError(`Action type not allowed: ${rawType || '(empty)'}`, {
            gameType: 'jeu-oie',
            action: rawType,
            allowedActions: Array.from(ALLOWED)
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new _gameerrors.GameValidationError("La partie n'est pas demarree.", {
            gameType: 'jeu-oie',
            action: rawType
        });
    }
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Acteur requis.', {
            gameType: 'jeu-oie'
        });
    }
    const pending = state.pending;
    if (pending) {
        const pawnValidation = (0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
            pending,
            actorId,
            actionType: normalized,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn'
        });
        if (pawnValidation.ok) {
            return pawnValidation.action;
        }
        if (pawnValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action indisponible (choix de pion requis).', {
                gameType: 'jeu-oie',
                playerId: actorId
            });
        }
        if (pawnValidation.reason === 'invalid_pawn') {
            throw new _gameerrors.PlayerActionError('Pion invalide.', {
                gameType: 'jeu-oie',
                playerId: actorId
            });
        }
        throw new _gameerrors.PlayerActionError('Action indisponible (choix en attente).', {
            gameType: 'jeu-oie',
            playerId: actorId
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, actorId)) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'jeu-oie',
            playerId: actorId,
            currentPlayerId: current
        });
    }
    if ((0, _actionservicehelper.isRollAlias)(rawType, normalized)) {
        return {
            ...action,
            type: 'roll',
            payload: {}
        };
    }
    return {
        ...action,
        type: 'roll',
        payload: {}
    };
}
