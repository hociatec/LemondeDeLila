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
const _cerclessacrescards = require("../model/cercles-sacres-cards");
const _cerclessacresstateentity = require("../model/cercles-sacres-state.entity");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function getMeta(state) {
    return state.metadata ?? {};
}
function hasCompleteCircle(cardIds) {
    const themes = new Set();
    for (const id of cardIds){
        const definition = _cerclessacrescards.CERCLES_SACRES_CARD_BY_ID[id];
        if (!definition) {
            return false;
        }
        themes.add(definition.theme);
    }
    return themes.size === 6;
}
function isHandOverLimit(meta, playerId) {
    const hand = meta.hands?.[playerId] ?? [];
    return hand.length > _cerclessacresstateentity.CERCLES_SACRES_HAND_LIMIT;
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    const meta = getMeta(state);
    const hand = Array.isArray(meta.hands?.[playerId]) ? [
        ...meta.hands[playerId]
    ] : [];
    const actions = [];
    if (!hand.length) {
        if (!isHandOverLimit(meta, playerId)) {
            actions.push({
                type: 'pass',
                payload: {}
            });
        }
        return actions;
    }
    for (const cardId of hand){
        actions.push({
            type: 'discard_card',
            payload: {
                cardId
            }
        });
    }
    if (isHandOverLimit(meta, playerId)) {
        return actions;
    }
    if (hand.length >= _cerclessacresstateentity.CERCLES_SACRES_HAND_MIN) {
        actions.push({
            type: 'form_circle',
            payload: {}
        });
    }
    actions.push({
        type: 'pass',
        payload: {}
    });
    return actions;
}
function validateAction(state, action, actorId) {
    const requestedType = (0, _actionservicehelper.normalizeActionType)(action);
    const type = requestedType;
    const payload = action?.payload ?? {};
    if (type !== 'form_circle' && type !== 'discard_card' && type !== 'pass') {
        throw new Error(`Action inconnue: ${requestedType ?? 'unknown'}`);
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
    const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
    if (type === 'pass') {
        if (isHandOverLimit(meta, actorId)) {
            throw new Error("Vous devez défausser jusqu'à revenir à 8 cartes.");
        }
        return {
            type: 'pass',
            payload: {}
        };
    }
    if (type === 'discard_card') {
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) {
            throw new Error('Carte introuvable.');
        }
        if (!hand.includes(cardId)) {
            throw new Error('Carte indisponible.');
        }
        return {
            type: 'discard_card',
            payload: {
                cardId
            }
        };
    }
    if (type === 'form_circle') {
        if (isHandOverLimit(meta, actorId)) {
            throw new Error('Réduisez votre main avant de former un cercle.');
        }
        const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds : [];
        if (cardIds.length !== 6) {
            throw new Error('Un cercle nécessite six cartes.');
        }
        const unique = new Set(cardIds);
        if (unique.size !== 6) {
            throw new Error('Chaque carte du cercle doit être unique.');
        }
        for (const cardId of cardIds){
            if (!hand.includes(cardId)) {
                throw new Error('Vous ne possédez pas toutes les cartes demandées.');
            }
            if (!_cerclessacrescards.CERCLES_SACRES_CARD_BY_ID[cardId]) {
                throw new Error(`Carte invalide : ${cardId}`);
            }
        }
        if (!hasCompleteCircle(cardIds)) {
            throw new Error('Chaque thème doit être représenté une fois.');
        }
        return {
            type: 'form_circle',
            payload: {
                cardIds
            }
        };
    }
    throw new Error('Action non supportée.');
}
