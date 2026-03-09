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
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
const _gamedefinition = require("../definitions/game.definition");
function getMeta(state) {
    return state.metadata ?? {};
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const currentPlayer = state.turn?.currentPlayerId ?? null;
    if (currentPlayer !== playerId) return [];
    const meta = getMeta(state);
    const available = [];
    if (meta.roundPhase === 'waiting_theme' && meta.masterId === playerId) {
        available.push({
            type: 'set_theme'
        });
        if ((meta.specialHands?.[playerId] ?? []).length) {
            available.push({
                type: 'play_special'
            });
        }
        return available;
    }
    if (meta.roundPhase === 'collecting_names' && meta.pendingPlayers.includes(playerId)) {
        available.push({
            type: 'play_name'
        });
        if ((meta.specialHands?.[playerId] ?? []).length) {
            available.push({
                type: 'play_special'
            });
        }
        available.push({
            type: 'pass'
        });
        return available;
    }
    if (meta.roundPhase === 'choosing_winner' && (meta.masterId === playerId || meta.juryOverrideId === playerId)) {
        available.push({
            type: 'choose_winner'
        });
        return available;
    }
    return [];
}
function validateAction(state, action, actorId) {
    const rawType = (0, _actionservicehelper.normalizeActionType)(action);
    const type = rawType;
    if (!_gamedefinition.GERARD_PRESIDENT_GAME.actions.includes(type)) {
        throw new _gameerrors.GameValidationError(`Action inconnue : ${rawType}`, {
            gameType: 'gerard-president'
        });
    }
    if (actorId == null) {
        throw new _gameerrors.PlayerActionError('Un joueur doit être indiqué.', {
            gameType: 'gerard-president'
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new _gameerrors.GameValidationError("La partie n'a pas démarré.", {
            gameType: 'gerard-president'
        });
    }
    const meta = getMeta(state);
    const current = state.turn?.currentPlayerId ?? null;
    const payload = action.payload ?? {};
    if (current !== actorId) {
        throw new _gameerrors.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'gerard-president',
            playerId: actorId
        });
    }
    if (type === 'set_theme') {
        if (meta.roundPhase !== 'waiting_theme') {
            throw new _gameerrors.GameValidationError('Un thème est déjà en cours.', {
                gameType: 'gerard-president'
            });
        }
        if (meta.masterId != null && meta.masterId !== actorId && meta.juryOverrideId !== actorId) {
            throw new _gameerrors.PlayerActionError("Vous n'êtes pas le Maître du Thème.", {
                gameType: 'gerard-president',
                playerId: actorId
            });
        }
        return {
            ...action,
            type
        };
    }
    if (type === 'play_name') {
        if (meta.roundPhase !== 'collecting_names') {
            throw new _gameerrors.GameValidationError('Il faut attendre un thème.', {
                gameType: 'gerard-president'
            });
        }
        if (!meta.pendingPlayers.includes(actorId)) {
            throw new _gameerrors.PlayerActionError('Vous avez déjà joué.', {
                gameType: 'gerard-president'
            });
        }
        const names = Array.isArray(payload.names) ? payload.names : [];
        if (!names.length) {
            throw new _gameerrors.GameValidationError('Aucun prénom sélectionné.', {
                gameType: 'gerard-president'
            });
        }
        return {
            ...action,
            type,
            payload: {
                names
            }
        };
    }
    if (type === 'play_special') {
        if (meta.roundPhase === 'choosing_winner') {
            throw new _gameerrors.GameValidationError('Impossible de jouer une carte maintenant.', {
                gameType: 'gerard-president'
            });
        }
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) {
            throw new _gameerrors.GameValidationError('Aucune carte spécifiée.', {
                gameType: 'gerard-president'
            });
        }
        const hand = meta.specialHands?.[actorId] ?? [];
        if (!hand.includes(cardId)) {
            throw new _gameerrors.GameValidationError('Vous ne possédez pas cette carte.', {
                gameType: 'gerard-president'
            });
        }
        return {
            ...action,
            type,
            payload: {
                ...payload,
                cardId
            }
        };
    }
    if (type === 'pass') {
        if (meta.roundPhase !== 'collecting_names') {
            throw new _gameerrors.GameValidationError('Vous ne pouvez pas passer maintenant.', {
                gameType: 'gerard-president'
            });
        }
        if (!meta.pendingPlayers.includes(actorId)) {
            throw new _gameerrors.PlayerActionError('Vous avez déjà joué.', {
                gameType: 'gerard-president'
            });
        }
        return {
            ...action,
            type
        };
    }
    if (type === 'choose_winner') {
        if (meta.roundPhase !== 'choosing_winner') {
            throw new _gameerrors.GameValidationError("Il faut d'abord collecter les prénoms.", {
                gameType: 'gerard-president'
            });
        }
        if (meta.masterId != null && meta.masterId !== actorId) {
            throw new _gameerrors.PlayerActionError("Vous n'êtes pas le Maître du Thème.", {
                gameType: 'gerard-president'
            });
        }
        const winnerId = payload.winnerId;
        if (typeof winnerId !== 'number') {
            throw new _gameerrors.GameValidationError('Vous devez choisir un gagnant.', {
                gameType: 'gerard-president'
            });
        }
        return {
            ...action,
            type,
            payload: {
                winnerId
            }
        };
    }
    return {
        ...action,
        type
    };
}
