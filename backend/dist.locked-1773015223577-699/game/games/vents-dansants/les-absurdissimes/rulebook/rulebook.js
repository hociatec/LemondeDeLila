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
    get getJudgeId () {
        return getJudgeId;
    },
    get validateAction () {
        return validateAction;
    }
});
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function getMeta(state) {
    return state.metadata ?? {};
}
function getPlayerIds(players) {
    return (Array.isArray(players) ? players : []).filter((player)=>typeof player?.id === 'number').map((player)=>player.id);
}
function getJudgeId(state, meta) {
    const players = getPlayerIds(state.players);
    if (!players.length) return null;
    const index = meta.judgeIndex % players.length;
    return players[index] ?? players[0] ?? null;
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const meta = getMeta(state);
    if (meta.winnerId != null) return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    const stage = meta.roundStage;
    if (stage === 'play') {
        const remaining = meta.remainingPlayers ?? getPlayerIds(state.players);
        if (!remaining.includes(playerId)) return [];
        const hand = meta.blackHands?.[playerId] ?? [];
        return hand.map((cardId)=>({
                type: 'play_card',
                payload: {
                    cardId
                }
            }));
    }
    if (stage === 'judge') {
        const judgeId = getJudgeId(state, meta);
        if (judgeId !== playerId) return [];
        const submissions = meta.submissions ?? {};
        return Object.keys(submissions).map((key)=>({
                type: 'judge_pick',
                payload: {
                    winnerId: Number(key)
                }
            }));
    }
    return [];
}
function validateAction(state, action, actorId) {
    const type = (0, _actionservicehelper.normalizeActionType)(action);
    if (type !== 'play_card' && type !== 'judge_pick') {
        throw new Error(`Action inconnue: ${type}`);
    }
    if (actorId == null) {
        throw new Error('Acteur requis');
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new Error("La partie n'est pas démarrée.");
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) {
        throw new Error("Ce n'est pas votre tour.");
    }
    const meta = getMeta(state);
    if (meta.winnerId != null) {
        throw new Error('La partie est terminée.');
    }
    const payload = action.payload ?? {};
    if (type === 'play_card') {
        if (meta.roundStage !== 'play') {
            throw new Error('Vous ne pouvez pas jouer une carte maintenant.');
        }
        const remaining = meta.remainingPlayers ?? getPlayerIds(state.players);
        if (!remaining.includes(actorId)) {
            throw new Error('Vous avez déjà joué cette manche.');
        }
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) {
            throw new Error('Carte invalide.');
        }
        const hand = meta.blackHands?.[actorId] ?? [];
        if (!hand.includes(cardId)) {
            throw new Error('Vous ne possédez pas cette carte.');
        }
        return {
            type: 'play_card',
            payload: {
                cardId
            }
        };
    }
    if (meta.roundStage !== 'judge') {
        throw new Error('Vous ne pouvez pas choisir de gagnant maintenant.');
    }
    const judgeId = getJudgeId(state, meta);
    if (judgeId !== actorId) {
        throw new Error('Seul le juge peut choisir un gagnant.');
    }
    const winnerId = typeof payload.winnerId === 'number' ? payload.winnerId : null;
    if (winnerId == null) {
        throw new Error('Sélection de gagnant invalide.');
    }
    const submissions = meta.submissions ?? {};
    if (!(winnerId in submissions)) {
        throw new Error('Aucune proposition pour ce joueur.');
    }
    return {
        type: 'judge_pick',
        payload: {
            winnerId
        }
    };
}
