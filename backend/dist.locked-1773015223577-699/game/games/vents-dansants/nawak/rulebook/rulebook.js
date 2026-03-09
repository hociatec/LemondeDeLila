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
function getMeta(state) {
    return state.metadata ?? {};
}
function getPlayerIds(players) {
    return (Array.isArray(players) ? players : []).filter((player)=>typeof player?.id === 'number').map((player)=>player.id);
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const meta = getMeta(state);
    if (meta.winnerId != null) return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    const actions = [];
    if (meta.roundStage === 'choose') {
        const submissions = meta.submissions ?? {};
        if (submissions[playerId] == null && meta.currentChallenge?.answers) {
            for(let index = 0; index < meta.currentChallenge.answers.length; index += 1){
                actions.push({
                    type: 'choose_answer',
                    payload: {
                        answerIndex: index
                    }
                });
            }
        }
    } else if (meta.roundStage === 'vote') {
        const votes = meta.votes ?? {};
        if (votes[playerId] == null) {
            const submissions = meta.submissions ?? {};
            const targets = getPlayerIds(state.players).filter((pid)=>pid !== playerId && submissions[pid] != null);
            for (const target of targets){
                actions.push({
                    type: 'vote_answer',
                    payload: {
                        targetPlayerId: target
                    }
                });
            }
        }
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, _actionservicehelper.normalizeActionType)(action);
    if (type !== 'choose_answer' && type !== 'vote_answer') {
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
    if (type === 'choose_answer') {
        if (meta.roundStage !== 'choose') {
            throw new Error('Vous ne pouvez pas choisir maintenant.');
        }
        const answerIndex = typeof payload.answerIndex === 'number' ? payload.answerIndex : null;
        if (answerIndex == null || answerIndex < 0 || answerIndex >= 3) {
            throw new Error('Réponse invalide.');
        }
        const submissions = meta.submissions ?? {};
        if (submissions[actorId] != null) {
            throw new Error('Vous avez déjà choisi une réponse.');
        }
        return {
            type: 'choose_answer',
            payload: {
                answerIndex
            }
        };
    }
    if (meta.roundStage !== 'vote') {
        throw new Error('Vous ne pouvez pas voter maintenant.');
    }
    const targetPlayerId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
    if (targetPlayerId == null || targetPlayerId === actorId) {
        throw new Error('Cible de vote invalide.');
    }
    const submissions = meta.submissions ?? {};
    if (submissions[targetPlayerId] == null) {
        throw new Error("La cible n'a pas soumis de réponse.");
    }
    const votes = meta.votes ?? {};
    if (votes[actorId] != null) {
        throw new Error('Vous avez déjà voté.');
    }
    return {
        type: 'vote_answer',
        payload: {
            targetPlayerId
        }
    };
}
