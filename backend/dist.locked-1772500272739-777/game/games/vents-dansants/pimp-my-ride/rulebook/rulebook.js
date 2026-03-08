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
const _pimpmyridecards = require("../model/pimp-my-ride-cards");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
function getMeta(state) {
    return state.metadata ?? {};
}
function getProgress(meta, playerId) {
    return meta.progress?.[playerId] ?? {
        stageIndex: 0,
        carParts: [],
        completedCars: []
    };
}
function getRequiredCategory(progress) {
    const stage = progress.stageIndex % _pimpmyridecards.PIMP_MY_RIDE_CATEGORY_ORDER.length;
    return _pimpmyridecards.PIMP_MY_RIDE_CATEGORY_ORDER[stage];
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const meta = getMeta(state);
    if (meta.winnerId != null) return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    const progress = getProgress(meta, playerId);
    const requiredCategory = getRequiredCategory(progress);
    const hand = Array.isArray(meta.hands?.[playerId]) ? meta.hands[playerId] : [];
    const actions = [
        {
            type: 'pass',
            payload: {}
        }
    ];
    for (const cardId of hand){
        const definition = _pimpmyridecards.PIMP_MY_RIDE_CARD_BY_ID[cardId];
        if (!definition) continue;
        if (definition.category === requiredCategory) {
            actions.push({
                type: 'play_card',
                payload: {
                    cardId
                }
            });
        }
    }
    if (meta.drawnPlayerId === playerId && meta.drawnCardId) {
        actions.push({
            type: 'discard_card',
            payload: {
                cardId: meta.drawnCardId
            }
        });
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, _actionservicehelper.normalizeActionType)(action);
    const payload = action?.payload ?? {};
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
        return {
            type: 'pass',
            payload: {}
        };
    }
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
        throw new Error('Carte manquante.');
    }
    const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
    if (!hand.includes(cardId)) {
        throw new Error('Carte indisponible.');
    }
    const definition = _pimpmyridecards.PIMP_MY_RIDE_CARD_BY_ID[cardId];
    if (!definition) {
        throw new Error('Carte invalide.');
    }
    if (type === 'play_card') {
        const progress = getProgress(meta, actorId);
        const requiredCategory = getRequiredCategory(progress);
        if (definition.category !== requiredCategory) {
            throw new Error("La carte ne correspond pas à l'étape en cours.");
        }
        return {
            type: 'play_card',
            payload: {
                cardId
            }
        };
    }
    if (type === 'discard_card') {
        if (meta.drawnPlayerId !== actorId || meta.drawnCardId !== cardId) {
            throw new Error('Vous ne pouvez jeter que la carte récemment piochée.');
        }
        return {
            type: 'discard_card',
            payload: {
                cardId
            }
        };
    }
    return {
        type: 'pass',
        payload: {}
    };
}
