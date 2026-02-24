"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const entre_rites_cards_1 = require("../model/entre-rites-cards");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
function getMeta(state) {
    return (state.metadata ?? {});
}
function hasFamilyExposure(meta, playerId, cardId) {
    const card = entre_rites_cards_1.ENTRE_RITES_CARD_BY_ID[cardId];
    if (!card || card.type !== 'family')
        return true;
    const hand = Array.isArray(meta.hands?.[playerId])
        ? meta.hands[playerId]
        : [];
    return hand.some((item) => {
        const definition = entre_rites_cards_1.ENTRE_RITES_CARD_BY_ID[item];
        return (definition?.type === 'family' && definition.familyId === card.familyId);
    });
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    const meta = getMeta(state);
    const peace = meta.peaceTurnsRemaining ?? 0;
    if (peace > 0) {
        return [{ type: 'pass', payload: {} }];
    }
    const actions = [];
    const opponents = (Array.isArray(state.players) ? state.players : [])
        .filter((p) => p?.id != null && p.id !== playerId)
        .map((p) => p.id);
    for (const opponentId of opponents) {
        const opponentHand = Array.isArray(meta.hands?.[opponentId])
            ? meta.hands[opponentId]
            : [];
        for (const cardId of opponentHand) {
            if (!hasFamilyExposure(meta, playerId, cardId)) {
                continue;
            }
            actions.push({
                type: 'ask_card',
                payload: {
                    cardId,
                    targetPlayerId: opponentId,
                },
            });
        }
    }
    actions.push({ type: 'pass', payload: {} });
    return actions;
}
function validateAction(state, action, actorId) {
    const requestedType = (0, action_service_helper_1.normalizeActionType)(action);
    const type = requestedType;
    const payload = (action?.payload ?? {});
    if (type !== 'ask_card' && type !== 'pass') {
        throw new Error(`Action inconnue : ${requestedType ?? 'unknown'}`);
    }
    if (actorId == null) {
        throw new Error('Acteur requis.');
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new Error('La partie n’est pas démarrée.');
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) {
        throw new Error("Ce n'est pas votre tour.");
    }
    const meta = getMeta(state);
    const peace = meta.peaceTurnsRemaining ?? 0;
    if (type === 'pass') {
        return { type: 'pass', payload: {} };
    }
    if (peace > 0) {
        throw new Error('La paix impose de passer ce tour.');
    }
    const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
        throw new Error('Carte introuvable.');
    }
    if (targetId == null || targetId === actorId) {
        throw new Error('Cible invalide.');
    }
    const targetHand = Array.isArray(meta.hands?.[targetId])
        ? meta.hands[targetId]
        : [];
    if (!targetHand.includes(cardId)) {
        throw new Error('La cible ne possède pas cette carte.');
    }
    if (!hasFamilyExposure(meta, actorId, cardId)) {
        throw new Error('Vous devez déjà détenir une carte de cette famille.');
    }
    return { type: 'ask_card', payload: { cardId, targetPlayerId: targetId } };
}
//# sourceMappingURL=rulebook.js.map