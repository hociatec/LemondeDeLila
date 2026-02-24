"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAT_PATTES_OBSTACLE_TO_PARADE = void 0;
exports.canPlayPattes = canPlayPattes;
exports.playerCanReceiveObstacle = playerCanReceiveObstacle;
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const cat_pattes_cards_1 = require("../model/cat-pattes-cards");
const cat_pattes_state_entity_1 = require("../model/cat-pattes-state.entity");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
const pawn_pending_rulebook_helper_1 = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const string_value_utils_1 = require("../../../../../common/utils/string-value.utils");
function getMeta(state) {
    return (state.metadata ?? {});
}
exports.CAT_PATTES_OBSTACLE_TO_PARADE = {
    gamelle: 'croquettes',
    pluie: 'rayon',
    chien: 'saut',
    coussin: 'coussin',
    sol: 'dodo',
};
function hasBot(bots, type) {
    return Array.isArray(bots) && bots.includes(type);
}
function samePlayerId(a, b) {
    const left = Number(a);
    const right = Number(b);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
}
function canPlayPattes(meta, playerId, card) {
    const hasSun = Boolean(meta.hasSun?.[playerId]);
    const bots = meta.bots?.[playerId] ?? [];
    const obstacle = meta.obstacles?.[playerId] ?? null;
    const passageStar = hasBot(bots, 'passage-star');
    if (!hasSun && !passageStar) {
        return false;
    }
    if (obstacle && !hasBot(bots, 'patte-blindee')) {
        return false;
    }
    const currentPos = Number(meta.positions?.[playerId] ?? 0);
    const delta = Number(card.value ?? 0);
    if (!Number.isFinite(delta) || delta <= 0)
        return false;
    return currentPos + delta <= cat_pattes_state_entity_1.CAT_PATTES_GOAL;
}
function playerCanReceiveObstacle(meta, playerId, obstacle) {
    const bots = meta.bots?.[playerId] ?? [];
    if (hasBot(bots, 'patte-blindee')) {
        return false;
    }
    if (obstacle === 'chien' && hasBot(bots, 'chat-ninja')) {
        return false;
    }
    if (obstacle === 'gamelle' && hasBot(bots, 'reserve')) {
        return false;
    }
    return !meta.obstacles?.[playerId];
}
function normalizePawnKey(value) {
    return (0, string_value_utils_1.stringOrEmpty)(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    const pending = state.pending;
    if (pending) {
        const pawnActions = (0, pawn_pending_rulebook_helper_1.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, playerId))
        return [];
    const meta = getMeta(state);
    if (!samePlayerId(meta.drawnPlayerId, playerId)) {
        return [{ type: 'draw', payload: {} }];
    }
    const hand = Array.isArray(meta.hands?.[playerId])
        ? [...meta.hands[playerId]]
        : [];
    const actions = [];
    const opponents = (Array.isArray(state.players) ? state.players : [])
        .filter((p) => p?.id != null && p.id !== playerId)
        .map((p) => p.id);
    for (const cardId of hand) {
        const definition = cat_pattes_cards_1.CAT_PATTES_CARD_BY_ID[cardId];
        if (!definition)
            continue;
        if (definition.type === 'pattes' &&
            !canPlayPattes(meta, playerId, definition)) {
            continue;
        }
        if (definition.type === 'obstacle') {
            for (const target of opponents) {
                if (!playerCanReceiveObstacle(meta, target, definition.obstacle)) {
                    continue;
                }
                actions.push({
                    type: 'play_card',
                    payload: { cardId, targetPlayerId: target },
                });
            }
        }
        else {
            actions.push({
                type: 'play_card',
                payload: { cardId },
            });
        }
        actions.push({
            type: 'discard_card',
            payload: { cardId },
        });
    }
    if (actions.length === 0) {
        return [{ type: 'pass', payload: {} }];
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, action_service_helper_1.normalizeActionType)(action);
    const payload = (action?.payload ?? {});
    if (type !== 'play_card' &&
        type !== 'discard_card' &&
        type !== 'draw' &&
        type !== 'choose_pawn' &&
        type !== 'pass') {
        throw new Error(`Action inconnue: ${type}`);
    }
    if (actorId == null) {
        throw new Error('Acteur requis');
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new Error("La partie n'est pas démarrée.");
    }
    const pending = state.pending;
    if (pending) {
        const pawnValidation = (0, pawn_pending_rulebook_helper_1.validatePendingPawnActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload,
            pendingType: 'choose_pawn',
            idResolver: (value) => normalizePawnKey(value),
        });
        if (pawnValidation.ok) {
            return pawnValidation.action;
        }
        if (pawnValidation.reason === 'wrong_action_type') {
            throw new Error('Action indisponible (choix de pion requis).');
        }
        if (pawnValidation.reason === 'invalid_pawn') {
            throw new Error('Pion invalide.');
        }
        throw new Error('Action indisponible (choix en attente).');
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, actorId)) {
        throw new Error("Ce n'est pas votre tour.");
    }
    const meta = getMeta(state);
    if (!samePlayerId(meta.drawnPlayerId, actorId)) {
        if (type !== 'draw') {
            throw new Error("Vous devez d'abord piocher.");
        }
        return { type: 'draw', payload: {} };
    }
    if (type === 'draw') {
        throw new Error('Carte déjà piochée ce tour.');
    }
    if (type === 'pass') {
        return { type: 'discard_card', payload: {} };
    }
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
        throw new Error('Carte introuvable.');
    }
    const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
    if (!hand.includes(cardId)) {
        throw new Error('Carte indisponible.');
    }
    const definition = cat_pattes_cards_1.CAT_PATTES_CARD_BY_ID[cardId];
    if (!definition) {
        throw new Error('Carte invalide.');
    }
    if (type === 'discard_card') {
        return { type: 'discard_card', payload: { cardId } };
    }
    if (definition.type === 'pattes' &&
        !canPlayPattes(meta, actorId, definition)) {
        throw new Error('Impossible de courir maintenant.');
    }
    if (definition.type === 'obstacle') {
        const targetId = typeof payload.targetPlayerId === 'number'
            ? payload.targetPlayerId
            : null;
        if (targetId == null) {
            throw new Error('La cible est requise pour une carte Obstacle.');
        }
        if (targetId === actorId) {
            throw new Error("Impossible de s'infliger son propre obstacle.");
        }
        const targetHand = Array.isArray(state.players) ? state.players : [];
        const exists = targetHand.some((p) => samePlayerId(p?.id, targetId));
        if (!exists) {
            throw new Error('Joueur cible invalide.');
        }
        if (!playerCanReceiveObstacle(meta, targetId, definition.obstacle)) {
            throw new Error('La cible ne peut pas recevoir cet obstacle.');
        }
    }
    return { type: 'play_card', payload: { ...payload, cardId } };
}
//# sourceMappingURL=rulebook.js.map