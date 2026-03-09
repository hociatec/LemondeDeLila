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
const _gamedefinition = require("../definitions/game.definition");
const _gameerrors = require("../../../../../common/errors/game-errors");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _pendingpawnmoverulebookhelper = require("../../../../core/helpers/pending-pawn-move-rulebook.helper");
function getAvailableActions(state, playerId) {
    if ((state.status || '').toLowerCase() !== 'started') return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    const pending = state.pending ?? null;
    if (pending) {
        if (pending.type === 'choose_family' && pending.playerId === playerId) {
            const familyIds = Array.isArray(pending?.data?.familyIds) ? pending.data.familyIds : [];
            return familyIds.filter((id)=>typeof id === 'string' && id.trim().length > 0).map((id)=>({
                    type: 'choose_family',
                    payload: {
                        familyId: String(id).trim()
                    }
                }));
        }
        const pendingMoveActions = (0, _pendingpawnmoverulebookhelper.getPendingPawnMoveActionsForPlayer)(pending, playerId, 'choose_pawn', 'move_pawn');
        if (pendingMoveActions.length > 0) {
            return pendingMoveActions;
        }
        return [];
    }
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
    const normalizedType = rawType.toLowerCase();
    const type = rawType;
    if (!_gamedefinition.FOULEES_FANTASTIQUES_GAME.actions.includes(type) && !_gamedefinition.FOULEES_FANTASTIQUES_GAME.actions.includes(normalizedType)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType}`, {
            gameType: 'foulees-fantastiques',
            action: rawType,
            allowedActions: _gamedefinition.FOULEES_FANTASTIQUES_GAME.actions
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId != null && actorId !== current) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'foulees-fantastiques',
            playerId: actorId,
            currentPlayerId: current
        });
    }
    if ((0, _actionservicehelper.isRollAlias)(type, normalizedType)) {
        return {
            ...action,
            type: 'roll',
            payload: {}
        };
    }
    if (type === 'roll') {
        return {
            ...action,
            type: 'roll',
            payload: {}
        };
    }
    if (type === 'choose_family') {
        const pending = state.pending ?? null;
        if (!pending || pending.type !== 'choose_family' || pending.playerId !== actorId) {
            throw new _gameerrors.PlayerActionError('Aucun choix de famille en attente.', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined
            });
        }
        const payload = action.payload ?? {};
        const familyId = String(payload.familyId ?? '').trim();
        if (!familyId) {
            throw new _gameerrors.GameValidationError('Payload invalide: familyId', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
                payload
            });
        }
        const allowed = Array.isArray(pending?.data?.familyIds) ? pending.data.familyIds : [];
        const ok = allowed.some((id)=>typeof id === 'string' && id.trim() === familyId);
        if (!ok) {
            throw new _gameerrors.GameValidationError('Famille invalide.', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
                payload
            });
        }
        const meta = state.metadata ?? {};
        const taken = Object.entries(meta.familyIdByPlayer ?? {}).some(([pid, fid])=>Number(pid) !== (actorId ?? NaN) && String(fid ?? '').trim() === familyId);
        if (taken) {
            throw new _gameerrors.GameValidationError('Famille déjà choisie.', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
                payload
            });
        }
        return {
            ...action,
            type: 'choose_family',
            payload: {
                familyId
            }
        };
    }
    if (type === 'move_pawn') {
        const pending = state.pending ?? null;
        const moveValidation = (0, _pendingpawnmoverulebookhelper.validatePendingPawnMoveActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn',
            expectedActionType: 'move_pawn'
        });
        if (!moveValidation.ok && moveValidation.reason === 'not_pending_for_actor') {
            throw new _gameerrors.PlayerActionError('Aucun choix de pion en attente.', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined
            });
        }
        if (!moveValidation.ok) {
            throw new _gameerrors.GameValidationError('Payload invalide: pawnIndex/targetProgress', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
                payload: action.payload
            });
        }
        return {
            ...action,
            type: 'move_pawn',
            payload: moveValidation.move
        };
    }
    return {
        ...action,
        type: 'roll',
        payload: {}
    };
}
