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
const _payloadvalidatorshelper = require("../../../../core/helpers/payload-validators.helper");
const _pawnpendingrulebookhelper = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const _pendingactionsrulebookhelper = require("../../../../core/helpers/pending-actions-rulebook.helper");
const _gameerrors = require("../../../../../common/errors/game-errors");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
const GAME_TYPE = 'a-fond-les-ballons';
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawActions = (0, _pendingactionsrulebookhelper.getPendingDrawActionsForPlayer)(pending, playerId);
        if (drawActions.length > 0) return drawActions;
        const pawnActions = (0, _pawnpendingrulebookhelper.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        if (pending.type === 'swap' && Number(pending.playerId) === playerId) {
            const targets = normalizeTargets(pending?.data?.targets);
            return targets.map((t)=>({
                    type: 'swap_choose_target',
                    payload: {
                        targetPlayerId: t.targetPlayerId
                    }
                }));
        }
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
    const type = (0, _actionservicehelper.normalizeActionType)(action);
    const isRoll = (0, _actionservicehelper.isRollActionType)(type);
    if (!isRoll && type !== 'choose_pawn' && type !== 'swap_choose_target' && type !== 'draw') {
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
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: GAME_TYPE
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (type === 'draw') {
        const pending = asPendingRecord(state.pending);
        const drawValidation = (0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type
        });
        if (!drawValidation.ok) {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
        }
        return drawValidation.action;
    }
    if (type === 'choose_pawn') {
        const pending = asPendingRecord(state.pending);
        const pawnValidation = (0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn'
        });
        if (!pawnValidation.ok && pawnValidation.reason === 'not_pending_for_actor') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
        }
        if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn') {
            throw new _gameerrors.GameValidationError('Pion invalide.', {
                gameType: GAME_TYPE,
                action: {
                    type,
                    payload: action.payload ?? null
                }
            });
        }
        if (!pawnValidation.ok) {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
        }
        return pawnValidation.action;
    }
    if (type === 'swap_choose_target') {
        const pending = asPendingRecord(state.pending);
        if (!pending || pending.type !== 'swap' || Number(pending.playerId) !== actorId) {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: GAME_TYPE
            });
        }
        const targets = normalizeTargets(pending?.data?.targets);
        const targetPlayerId = (()=>{
            try {
                return (0, _payloadvalidatorshelper.requiredInt)(action.payload ?? {}, 'targetPlayerId', 'Cible invalide.');
            } catch  {
                throw new _gameerrors.GameValidationError('Cible invalide.', {
                    gameType: GAME_TYPE,
                    action: {
                        type,
                        payload: action.payload ?? null
                    }
                });
            }
        })();
        if (!targets.some((t)=>t.targetPlayerId === targetPlayerId)) {
            throw new _gameerrors.GameValidationError('Cible invalide.', {
                gameType: GAME_TYPE,
                action: {
                    type,
                    payload: action.payload ?? null
                }
            });
        }
        return {
            type: 'swap_choose_target',
            payload: {
                targetPlayerId
            }
        };
    }
    if (state.pending) {
        throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: GAME_TYPE
        });
    }
    if (current !== actorId) {
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
function normalizeTargets(value) {
    if (!Array.isArray(value)) return [];
    return value.map((entry)=>{
        const record = asRecord(entry);
        const targetPlayerId = Number(record.targetPlayerId);
        return Number.isFinite(targetPlayerId) ? {
            targetPlayerId
        } : null;
    }).filter((entry)=>entry !== null);
}
function toText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
}
