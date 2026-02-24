"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const la_grande_mine_cards_1 = require("../model/la-grande-mine-cards");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    const meta = getMeta(state);
    const hand = meta.hands?.[playerId] ?? [];
    const actions = [
        {
            type: 'pass',
            payload: {},
        },
    ];
    for (const cardId of hand) {
        actions.push({
            type: 'play_card',
            payload: { cardId },
        });
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, action_service_helper_1.normalizeActionType)(action);
    if (!actorId) {
        throw new Error('Acteur requis.');
    }
    if (!(0, rulebook_guard_helper_1.isStartedState)(state)) {
        throw new Error("La partie n'est pas active.");
    }
    if (state.turn?.currentPlayerId !== actorId) {
        throw new Error("Ce n'est pas votre tour.");
    }
    if (type !== 'play_card' && type !== 'pass') {
        throw new Error(`Action inconnue : ${type}`);
    }
    if (type === 'play_card') {
        const payload = (action.payload ?? {});
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) {
            throw new Error('Carte manquante.');
        }
        const meta = getMeta(state);
        const hand = Array.isArray(meta.hands?.[actorId])
            ? meta.hands[actorId]
            : [];
        if (!hand.includes(cardId)) {
            throw new Error("Cette carte n'est pas dans votre main.");
        }
        const definition = la_grande_mine_cards_1.LA_GRANDE_MINE_CARD_BY_ID[cardId];
        if (!definition) {
            throw new Error('Carte inconnue.');
        }
    }
    return action;
}
function getMeta(state) {
    return (state.metadata ?? {});
}
//# sourceMappingURL=rulebook.js.map