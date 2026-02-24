"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const game_errors_1 = require("../../../../../common/errors/game-errors");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const game_definition_1 = require("../definitions/game.definition");
function getMeta(state) {
    return (state.metadata ?? {});
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const currentPlayer = state.turn?.currentPlayerId ?? null;
    if (currentPlayer !== playerId)
        return [];
    const meta = getMeta(state);
    const available = [];
    if (meta.roundPhase === 'waiting_theme' && meta.masterId === playerId) {
        available.push({ type: 'set_theme' });
        if ((meta.specialHands?.[playerId] ?? []).length) {
            available.push({ type: 'play_special' });
        }
        return available;
    }
    if (meta.roundPhase === 'collecting_names' &&
        meta.pendingPlayers.includes(playerId)) {
        available.push({ type: 'play_name' });
        if ((meta.specialHands?.[playerId] ?? []).length) {
            available.push({ type: 'play_special' });
        }
        available.push({ type: 'pass' });
        return available;
    }
    if (meta.roundPhase === 'choosing_winner' &&
        (meta.masterId === playerId || meta.juryOverrideId === playerId)) {
        available.push({ type: 'choose_winner' });
        return available;
    }
    return [];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const type = rawType;
    if (!game_definition_1.GERARD_PRESIDENT_GAME.actions.includes(type)) {
        throw new game_errors_1.GameValidationError(`Action inconnue : ${rawType}`, {
            gameType: 'gerard-president',
        });
    }
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Un joueur doit être indiqué.', {
            gameType: 'gerard-president',
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new game_errors_1.GameValidationError("La partie n'a pas démarré.", {
            gameType: 'gerard-president',
        });
    }
    const meta = getMeta(state);
    const current = state.turn?.currentPlayerId ?? null;
    const payload = (action.payload ?? {});
    if (current !== actorId) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'gerard-president',
            playerId: actorId,
        });
    }
    if (type === 'set_theme') {
        if (meta.roundPhase !== 'waiting_theme') {
            throw new game_errors_1.GameValidationError('Un thème est déjà en cours.', {
                gameType: 'gerard-president',
            });
        }
        if (meta.masterId != null &&
            meta.masterId !== actorId &&
            meta.juryOverrideId !== actorId) {
            throw new game_errors_1.PlayerActionError("Vous n'êtes pas le Maître du Thème.", {
                gameType: 'gerard-president',
                playerId: actorId,
            });
        }
        return { ...action, type };
    }
    if (type === 'play_name') {
        if (meta.roundPhase !== 'collecting_names') {
            throw new game_errors_1.GameValidationError('Il faut attendre un thème.', {
                gameType: 'gerard-president',
            });
        }
        if (!meta.pendingPlayers.includes(actorId)) {
            throw new game_errors_1.PlayerActionError('Vous avez déjà joué.', {
                gameType: 'gerard-president',
            });
        }
        const names = Array.isArray(payload.names) ? payload.names : [];
        if (!names.length) {
            throw new game_errors_1.GameValidationError('Aucun prénom sélectionné.', {
                gameType: 'gerard-president',
            });
        }
        return { ...action, type, payload: { names } };
    }
    if (type === 'play_special') {
        if (meta.roundPhase === 'choosing_winner') {
            throw new game_errors_1.GameValidationError('Impossible de jouer une carte maintenant.', {
                gameType: 'gerard-president',
            });
        }
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) {
            throw new game_errors_1.GameValidationError('Aucune carte spécifiée.', {
                gameType: 'gerard-president',
            });
        }
        const hand = meta.specialHands?.[actorId] ?? [];
        if (!hand.includes(cardId)) {
            throw new game_errors_1.GameValidationError('Vous ne possédez pas cette carte.', {
                gameType: 'gerard-president',
            });
        }
        return { ...action, type, payload: { ...payload, cardId } };
    }
    if (type === 'pass') {
        if (meta.roundPhase !== 'collecting_names') {
            throw new game_errors_1.GameValidationError('Vous ne pouvez pas passer maintenant.', {
                gameType: 'gerard-president',
            });
        }
        if (!meta.pendingPlayers.includes(actorId)) {
            throw new game_errors_1.PlayerActionError('Vous avez déjà joué.', {
                gameType: 'gerard-president',
            });
        }
        return { ...action, type };
    }
    if (type === 'choose_winner') {
        if (meta.roundPhase !== 'choosing_winner') {
            throw new game_errors_1.GameValidationError("Il faut d'abord collecter les prénoms.", {
                gameType: 'gerard-president',
            });
        }
        if (meta.masterId != null && meta.masterId !== actorId) {
            throw new game_errors_1.PlayerActionError("Vous n'êtes pas le Maître du Thème.", {
                gameType: 'gerard-president',
            });
        }
        const winnerId = payload.winnerId;
        if (typeof winnerId !== 'number') {
            throw new game_errors_1.GameValidationError('Vous devez choisir un gagnant.', {
                gameType: 'gerard-president',
            });
        }
        return { ...action, type, payload: { winnerId } };
    }
    return { ...action, type };
}
//# sourceMappingURL=rulebook.js.map