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
const _froussedefinition = require("../definitions/frousse.definition");
const _pawnsutils = require("../pawns.utils");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _pawnpendingrulebookhelper = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const _pendingactionsrulebookhelper = require("../../../../core/helpers/pending-actions-rulebook.helper");
const _playeridhelper = require("../../../../core/helpers/player-id.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawActions = (0, _pendingactionsrulebookhelper.getPendingDrawActionsForPlayer)(pending, playerId, {
            samePlayer: (left, right)=>(0, _playeridhelper.toPlayerId)(left) === (0, _playeridhelper.toPlayerId)(right)
        });
        if (drawActions.length > 0) return drawActions;
        const pawnActions = (0, _pawnpendingrulebookhelper.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        const targetActions = (0, _pendingactionsrulebookhelper.getPendingChooseTargetActionsForPlayer)(pending, playerId, {
            samePlayer: (left, right)=>(0, _playeridhelper.toPlayerId)(left) === (0, _playeridhelper.toPlayerId)(right)
        });
        if (targetActions.length > 0) {
            if (toText(pending.type) === 'choose_target' && asRecord(asRecord(pending).data).canDecline === true && (0, _playeridhelper.toPlayerId)(pending.playerId) === playerId) {
                return [
                    ...targetActions,
                    {
                        type: 'swap_decline',
                        payload: {}
                    }
                ];
            }
            return targetActions;
        }
        if (toText(pending.type) === 'choose_target' && asRecord(asRecord(pending).data).canDecline === true && (0, _playeridhelper.toPlayerId)(pending.playerId) === playerId) {
            return [
                {
                    type: 'swap_decline',
                    payload: {}
                }
            ];
        }
        return [];
    }
    const current = (0, _playeridhelper.toPlayerId)(state.turn?.currentPlayerId ?? null);
    if (current == null || current !== playerId) return [];
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
    if (!_froussedefinition.FROUSSE_GAME.actions.includes(type)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'frousse-party',
            action: rawType,
            allowedActions: _froussedefinition.FROUSSE_GAME.actions
        });
    }
    if (actorId == null) throw new _gameerrors.PlayerActionError('Acteur requis.', {
        gameType: 'frousse-party'
    });
    if (!(0, _rulebookguardhelper.isStartedState)(state)) {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'frousse-party'
        });
    }
    const pending = asPendingRecord(state.pending);
    if (pending) {
        const drawValidation = (0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type,
            samePlayer: (left, right)=>(0, _playeridhelper.toPlayerId)(left) === (0, _playeridhelper.toPlayerId)(right)
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pending.type === 'draw' && drawValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: 'frousse-party'
            });
        }
        const pendingType = toText(pending.type);
        if (pendingType === 'choose_pawn') {
            const pawnValidation = (0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_pawn',
                idResolver: (value)=>String((0, _pawnsutils.resolvePawnId)(value) ?? '').trim()
            });
            if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type') {
                throw new _gameerrors.PlayerActionError('Choix invalide.', {
                    gameType: 'frousse-party'
                });
            }
            if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn') {
                throw new _gameerrors.GameValidationError('Pion invalide.', {
                    gameType: 'frousse-party',
                    pawnId: asRecord(action.payload).pawnId ?? asRecord(action.payload).pawn ?? asRecord(action.payload).value ?? null
                });
            }
            if (!pawnValidation.ok) {
                throw new _gameerrors.PlayerActionError('Choix invalide.', {
                    gameType: 'frousse-party'
                });
            }
            return pawnValidation.action;
        }
        if (pendingType === 'choose_target' && type === 'swap_decline') {
            if (asRecord(asRecord(pending).data).canDecline === true && (0, _playeridhelper.toPlayerId)(pending.playerId) === actorId) {
                return {
                    type: 'swap_decline',
                    payload: {}
                };
            }
            throw new _gameerrors.PlayerActionError('Choix invalide.', {
                gameType: 'frousse-party'
            });
        }
        const targetValidation = (0, _pendingactionsrulebookhelper.validatePendingChooseTargetActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            samePlayer: (left, right)=>(0, _playeridhelper.toPlayerId)(left) === (0, _playeridhelper.toPlayerId)(right)
        });
        if (targetValidation.ok) {
            return targetValidation.action;
        }
        if (pendingType === 'choose_target' && targetValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Choix invalide.', {
                gameType: 'frousse-party'
            });
        }
        if (pendingType === 'choose_target' && targetValidation.reason === 'invalid_target') {
            throw new _gameerrors.GameValidationError('Cible invalide.', {
                gameType: 'frousse-party',
                targetPlayerId: targetValidation.targetPlayerId
            });
        }
        const pendingPlayerId = (0, _playeridhelper.toPlayerId)(pending.playerId);
        if (pendingPlayerId == null || pendingPlayerId !== actorId) {
            throw new _gameerrors.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'frousse-party'
            });
        }
        throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: 'frousse-party'
        });
    }
    const current = (0, _playeridhelper.toPlayerId)(state.turn?.currentPlayerId ?? null);
    if (current != null && actorId !== current) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'frousse-party',
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
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function toText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
}
function asPendingRecord(value) {
    if (!value || typeof value !== 'object') return null;
    return value;
}
