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
const _aventuresauvagepawns = require("../aventure-sauvage.pawns");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _pawnpendingrulebookhelper = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const _pendingactionsrulebookhelper = require("../../../../core/helpers/pending-actions-rulebook.helper");
const _gameerrors = require("../../../../../common/errors/game-errors");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
const GAME_TYPE = 'aventure-sauvage';
function samePlayerId(a, b) {
    const left = Number(a);
    const right = Number(b);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawActions = (0, _pendingactionsrulebookhelper.getPendingDrawActionsForPlayer)(pending, playerId, {
            samePlayer: samePlayerId
        });
        if (drawActions.length > 0) return drawActions;
        const pawnActions = (0, _pawnpendingrulebookhelper.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, playerId)) return [];
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
    if (!isRoll && type !== 'draw' && type !== 'choose_pawn') {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${type}`, {
            gameType: GAME_TYPE,
            action: {
                type
            }
        });
    }
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Acteur requis.', {
            gameType: GAME_TYPE
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new _gameerrors.PlayerActionError("La partie n'est pas demarree.", {
            gameType: GAME_TYPE
        });
    }
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawValidation = (0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type,
            samePlayer: samePlayerId
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pending.type === 'draw' && drawValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
        }
        const pawnValidation = (0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn',
            idResolver: (value)=>String((0, _aventuresauvagepawns.resolvePawnId)(value) ?? '').trim()
        });
        if (pawnValidation.ok) {
            return pawnValidation.action;
        }
        if (pawnValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
        }
        if (pawnValidation.reason === 'invalid_pawn') {
            throw new _gameerrors.GameValidationError('Pion invalide.', {
                gameType: GAME_TYPE,
                action: {
                    type,
                    payload: action.payload ?? null
                }
            });
        }
        throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: GAME_TYPE
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, actorId)) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: GAME_TYPE
        });
    }
    return {
        type: 'roll',
        payload: {}
    };
}
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function asPendingRecord(value) {
    if (!value || typeof value !== 'object') return null;
    const record = asRecord(value);
    return {
        type: toText(record.type),
        playerId: record.playerId,
        data: asRecord(record.data)
    };
}
function toText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
}
