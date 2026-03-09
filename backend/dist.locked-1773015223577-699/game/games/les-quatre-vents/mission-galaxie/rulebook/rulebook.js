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
const _missiongalaxiedefinition = require("../definitions/mission-galaxie.definition");
const _pendingactionsrulebookhelper = require("../../../../core/helpers/pending-actions-rulebook.helper");
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function readEventMoveOptions(pending) {
    const row = asRecord(pending);
    const data = asRecord(row.data);
    const options = Array.isArray(data.options) ? data.options : [];
    return options.map((entry)=>{
        const option = asRecord(entry);
        return {
            targetPlayerId: Number(option.targetPlayerId),
            delta: Number(option.delta)
        };
    }).filter((entry)=>Number.isFinite(entry.targetPlayerId) && Number.isFinite(entry.delta));
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const pending = state.pending;
    if (pending) {
        const pendingRow = asRecord(pending);
        if (Number(pendingRow.playerId ?? null) !== playerId) return [];
        const drawActions = (0, _pendingactionsrulebookhelper.getPendingDrawActionsForPlayer)(pending, playerId);
        if (drawActions.length > 0) return drawActions;
        if (pendingRow.type === 'choose_option') {
            return (0, _pendingactionsrulebookhelper.getPendingIndexedChoiceActionsForPlayer)(pending, playerId, {
                pendingType: 'choose_option',
                actionType: 'choose_option',
                payloadIndexKey: 'choiceIndex',
                choicesContainer: 'data',
                choicesKey: 'choices'
            });
        }
        if (pendingRow.type === 'choose_event_move') {
            const options = readEventMoveOptions(pending);
            return options.map((opt)=>({
                    type: 'choose_event_move',
                    payload: {
                        targetPlayerId: opt.targetPlayerId,
                        delta: opt.delta
                    }
                }));
        }
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
    if (!_missiongalaxiedefinition.MISSION_GALAXIE_GAME.actions.includes(type)) {
        throw new _gameerrors.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'mission-galaxie',
            action: rawType,
            allowedActions: _missiongalaxiedefinition.MISSION_GALAXIE_GAME.actions
        });
    }
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Acteur requis.', {
            gameType: 'mission-galaxie'
        });
    }
    if (!(0, _rulebookguardhelper.isStartedState)(state)) {
        throw new _gameerrors.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'mission-galaxie'
        });
    }
    const pending = state.pending;
    if (pending) {
        const pendingRow = asRecord(pending);
        if (Number(pendingRow.playerId ?? null) !== actorId) {
            throw new _gameerrors.PlayerActionError("Ce n'est pas votre action.", {
                gameType: 'mission-galaxie'
            });
        }
        const drawValidation = (0, _pendingactionsrulebookhelper.validatePendingDrawActionForActor)({
            pending,
            actorId,
            actionType: type
        });
        if (drawValidation.ok) {
            return drawValidation.action;
        }
        if (pendingRow.type === 'draw' && drawValidation.reason === 'wrong_action_type') {
            throw new _gameerrors.PlayerActionError('Action non disponible.', {
                gameType: 'mission-galaxie'
            });
        }
        if (pendingRow.type === 'choose_option') {
            const choiceValidation = (0, _pendingactionsrulebookhelper.validatePendingIndexedChoiceActionForActor)({
                pending,
                actorId,
                actionType: type,
                payload: action.payload ?? {},
                pendingType: 'choose_option',
                expectedActionType: 'choose_option',
                payloadIndexKey: 'choiceIndex',
                choicesContainer: 'data',
                choicesKey: 'choices'
            });
            if (!choiceValidation.ok && choiceValidation.reason === 'wrong_action_type') {
                throw new _gameerrors.PlayerActionError('Action non disponible.', {
                    gameType: 'mission-galaxie'
                });
            }
            if (!choiceValidation.ok) {
                const payload = asRecord(action.payload);
                throw new _gameerrors.GameValidationError('Choix invalide.', {
                    gameType: 'mission-galaxie',
                    choiceIndex: Number(payload.choiceIndex)
                });
            }
            return choiceValidation.action;
        }
        if (pendingRow.type === 'choose_event_move') {
            if (type !== 'choose_event_move') {
                throw new _gameerrors.PlayerActionError('Action non disponible.', {
                    gameType: 'mission-galaxie'
                });
            }
            const options = readEventMoveOptions(pending);
            const payload = asRecord(action.payload);
            const targetPlayerId = Number(payload.targetPlayerId);
            const delta = Number(payload.delta);
            if (!Number.isFinite(targetPlayerId) || !Number.isFinite(delta) || !options.some((opt)=>opt.targetPlayerId === targetPlayerId && opt.delta === delta)) {
                throw new _gameerrors.GameValidationError('Choix invalide.', {
                    gameType: 'mission-galaxie',
                    targetPlayerId,
                    delta
                });
            }
            return {
                type: 'choose_event_move',
                payload: {
                    targetPlayerId,
                    delta
                }
            };
        }
        throw new _gameerrors.PlayerActionError('Action non disponible.', {
            gameType: 'mission-galaxie'
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'mission-galaxie',
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
