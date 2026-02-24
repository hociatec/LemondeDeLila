"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const pimp_my_ride_cards_1 = require("../model/pimp-my-ride-cards");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
function getMeta(state) {
    return (state.metadata ?? {});
}
function getProgress(meta, playerId) {
    return (meta.progress?.[playerId] ?? {
        stageIndex: 0,
        carParts: [],
        completedCars: [],
    });
}
function getRequiredCategory(progress) {
    const stage = progress.stageIndex % pimp_my_ride_cards_1.PIMP_MY_RIDE_CATEGORY_ORDER.length;
    return pimp_my_ride_cards_1.PIMP_MY_RIDE_CATEGORY_ORDER[stage];
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const meta = getMeta(state);
    if (meta.winnerId != null)
        return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    const progress = getProgress(meta, playerId);
    const requiredCategory = getRequiredCategory(progress);
    const hand = Array.isArray(meta.hands?.[playerId])
        ? meta.hands[playerId]
        : [];
    const actions = [{ type: 'pass', payload: {} }];
    for (const cardId of hand) {
        const definition = pimp_my_ride_cards_1.PIMP_MY_RIDE_CARD_BY_ID[cardId];
        if (!definition)
            continue;
        if (definition.category === requiredCategory) {
            actions.push({ type: 'play_card', payload: { cardId } });
        }
    }
    if (meta.drawnPlayerId === playerId && meta.drawnCardId) {
        actions.push({
            type: 'discard_card',
            payload: { cardId: meta.drawnCardId },
        });
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, action_service_helper_1.normalizeActionType)(action);
    const payload = (action?.payload ?? {});
    if (type !== 'play_card' && type !== 'discard_card' && type !== 'pass') {
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
    const meta = getMeta(state);
    if (meta.winnerId != null) {
        throw new Error('La partie est déjà terminée.');
    }
    if (type === 'pass') {
        return { type: 'pass', payload: {} };
    }
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
        throw new Error('Carte manquante.');
    }
    const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
    if (!hand.includes(cardId)) {
        throw new Error('Carte indisponible.');
    }
    const definition = pimp_my_ride_cards_1.PIMP_MY_RIDE_CARD_BY_ID[cardId];
    if (!definition) {
        throw new Error('Carte invalide.');
    }
    if (type === 'play_card') {
        const progress = getProgress(meta, actorId);
        const requiredCategory = getRequiredCategory(progress);
        if (definition.category !== requiredCategory) {
            throw new Error("La carte ne correspond pas à l'étape en cours.");
        }
        return { type: 'play_card', payload: { cardId } };
    }
    if (type === 'discard_card') {
        if (meta.drawnPlayerId !== actorId || meta.drawnCardId !== cardId) {
            throw new Error('Vous ne pouvez jeter que la carte récemment piochée.');
        }
        return { type: 'discard_card', payload: { cardId } };
    }
    return { type: 'pass', payload: {} };
}
//# sourceMappingURL=rulebook.js.map