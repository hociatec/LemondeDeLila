"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const les_mains_de_la_terre_cards_1 = require("../model/les-mains-de-la-terre-cards");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
function getMeta(state) {
    return (state.metadata ?? {});
}
function getPlayerIds(players) {
    return (Array.isArray(players) ? players : [])
        .filter((player) => typeof player?.id === 'number')
        .map((player) => player.id);
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    if (state.turn?.currentPlayerId !== playerId)
        return [];
    const meta = getMeta(state);
    if (meta.winnerId != null)
        return [];
    const freeRequest = Boolean(meta.freeFamilyRequest?.[playerId]);
    const hand = Array.isArray(meta.hands?.[playerId])
        ? meta.hands[playerId]
        : [];
    const ownedFamilies = freeRequest
        ? new Set(les_mains_de_la_terre_cards_1.LES_MAINS_FAMILIES)
        : new Set(hand
            .map((cardId) => les_mains_de_la_terre_cards_1.LES_MAINS_CARD_BY_ID[cardId]?.family)
            .filter((family) => Boolean(family)));
    const targets = getPlayerIds(state.players).filter((pid) => pid !== playerId);
    const requestedCards = Object.values(les_mains_de_la_terre_cards_1.LES_MAINS_CARD_BY_ID).filter((card) => card.family && card.type === 'metier');
    const actions = [];
    for (const targetId of targets) {
        for (const card of requestedCards) {
            if (!card.family)
                continue;
            if (!ownedFamilies.has(card.family))
                continue;
            actions.push({
                type: 'request_card',
                payload: { cardId: card.id, targetPlayerId: targetId },
            });
        }
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, action_service_helper_1.normalizeActionType)(action);
    if (type !== 'request_card') {
        throw new Error(`Action inconnue: ${type}`);
    }
    if (actorId == null) {
        throw new Error('Acteur requis');
    }
    const meta = getMeta(state);
    if (meta.winnerId != null) {
        throw new Error('La partie est terminée.');
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new Error("La partie n'est pas démarrée.");
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) {
        throw new Error("Ce n'est pas votre tour.");
    }
    const payload = (action.payload ?? {});
    const cardId = String(payload.cardId ?? '').trim();
    const target = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
    if (!cardId || target == null || target === actorId) {
        throw new Error('Cible ou carte invalide.');
    }
    const definition = les_mains_de_la_terre_cards_1.LES_MAINS_CARD_BY_ID[cardId];
    if (!definition || definition.type !== 'metier' || !definition.family) {
        throw new Error("La carte demandée n'est pas une carte métier valide.");
    }
    const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
    const hasFamily = hand.some((card) => les_mains_de_la_terre_cards_1.LES_MAINS_CARD_BY_ID[card]?.family === definition.family);
    const freeRequest = Boolean(meta.freeFamilyRequest?.[actorId]);
    if (!hasFamily && !freeRequest) {
        throw new Error('Vous devez posséder au moins une carte de cette famille pour la demander.');
    }
    const targetExists = getPlayerIds(state.players).includes(target);
    if (!targetExists) {
        throw new Error('Joueur cible invalide.');
    }
    return { type: 'request_card', payload: { cardId, targetPlayerId: target } };
}
//# sourceMappingURL=rulebook.js.map