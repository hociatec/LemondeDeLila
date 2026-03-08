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
const _laparadesucreecards = require("../model/la-parade-sucree-cards");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) {
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    const meta = getMeta(state);
    const nextValue = _laparadesucreecards.LA_PARADE_SEQUENCE[meta.sequenceIndex];
    const hand = Array.isArray(meta.hands?.[playerId]) ? meta.hands[playerId] : [];
    const playable = hand.filter((cardId)=>_laparadesucreecards.LA_PARADE_CARD_BY_ID[cardId]?.value === nextValue);
    const actions = [
        {
            type: 'pass',
            payload: {}
        }
    ];
    for (const cardId of playable){
        actions.push({
            type: 'play_card',
            payload: {
                cardId
            }
        });
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, _actionservicehelper.normalizeActionType)(action);
    if (!actorId) {
        throw new Error('Acteur requis.');
    }
    if (!(0, _rulebookguardhelper.isStartedState)(state)) {
        throw new Error("La partie n'est pas active.");
    }
    if (state.turn?.currentPlayerId !== actorId) {
        throw new Error("Ce n'est pas votre tour.");
    }
    if (type !== 'play_card' && type !== 'pass') {
        throw new Error(`Action inconnue : ${type}`);
    }
    if (type === 'play_card') {
        const payload = action.payload ?? {};
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) {
            throw new Error('Carte manquante.');
        }
        const meta = getMeta(state);
        const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
        if (!hand.includes(cardId)) {
            throw new Error("Cette carte n'est pas dans votre main.");
        }
        const expected = _laparadesucreecards.LA_PARADE_SEQUENCE[meta.sequenceIndex];
        const definition = _laparadesucreecards.LA_PARADE_CARD_BY_ID[cardId];
        if (!definition || definition.value !== expected) {
            throw new Error("Ce n'est pas la carte attendue.");
        }
    }
    return action;
}
function getMeta(state) {
    return state.metadata ?? {};
}
