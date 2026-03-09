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
const _damenaturecards = require("../model/dame-nature-cards");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function getMeta(state) {
    return state.metadata ?? {};
}
function getPlayerHand(meta, playerId) {
    return Array.isArray(meta.hands?.[playerId]) ? meta.hands[playerId] : [];
}
function getOpponents(state, playerId) {
    return (Array.isArray(state.players) ? state.players : []).filter((player)=>player?.id != null && player.id !== playerId).map((player)=>player.id);
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    const meta = getMeta(state);
    const opponents = getOpponents(state, playerId);
    const actions = [
        {
            type: 'pass',
            payload: {}
        }
    ];
    for (const opponentId of opponents){
        const hand = getPlayerHand(meta, opponentId);
        for (const cardId of hand){
            const definition = _damenaturecards.DAME_NATURE_CARD_BY_ID[cardId];
            if (!definition || definition.type !== 'family') continue;
            actions.push({
                type: 'ask_card',
                payload: {
                    cardId,
                    targetPlayerId: opponentId
                }
            });
        }
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, _actionservicehelper.normalizeActionType)(action);
    const payload = action?.payload ?? {};
    if (type !== 'ask_card' && type !== 'pass') {
        throw new Error(`Action inconnue : ${type}`);
    }
    if (actorId == null) {
        throw new Error('Acteur requis.');
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new Error("La partie n'est pas commencée.");
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) {
        throw new Error("Ce n'est pas votre tour.");
    }
    if (type === 'pass') {
        return {
            type: 'pass',
            payload: {}
        };
    }
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
        throw new Error('Carte manquante.');
    }
    const target = payload.targetPlayerId;
    if (typeof target !== 'number') {
        throw new Error('Cible requise.');
    }
    if (target === actorId) {
        throw new Error('Impossible de demander à soi-même.');
    }
    const meta = getMeta(state);
    const targetHand = getPlayerHand(meta, target);
    if (!targetHand.includes(cardId)) {
        throw new Error('La cible ne possède pas cette carte.');
    }
    const definition = _damenaturecards.DAME_NATURE_CARD_BY_ID[cardId];
    if (!definition || definition.type !== 'family') {
        throw new Error('Carte invalide pour cette action.');
    }
    return {
        type: 'ask_card',
        payload: {
            cardId,
            targetPlayerId: target
        }
    };
}
