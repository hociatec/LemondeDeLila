"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CerclesSacresActionService", {
    enumerable: true,
    get: function() {
        return CerclesSacresActionService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _cerclessacrescards = require("../model/cercles-sacres-cards");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _cerclessacresstateentity = require("../model/cercles-sacres-state.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let CerclesSacresActionService = class CerclesSacresActionService {
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                discard_card: ()=>this.handleDiscardCard(next, action),
                form_circle: ()=>this.handleFormCircle(next, action),
                pass: ()=>this.handlePass(next, action)
            }, ()=>next);
        });
    }
    handlePass(state, _action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let next = this.ensurePlayerDrawn(state, currentId);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} passe son tour.`);
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    handleDiscardCard(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let next = this.ensurePlayerDrawn(state, currentId);
        const payload = action.payload ?? {};
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) return next;
        const meta = this.getMeta(next);
        const hand = Array.isArray(meta.hands?.[currentId]) ? [
            ...meta.hands[currentId]
        ] : [];
        if (!hand.includes(cardId)) return next;
        let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
        updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
        next = this.setMeta(next, updatedMeta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} défausse ${_cerclessacrescards.CERCLES_SACRES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`);
        return next;
    }
    handleFormCircle(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let next = this.ensurePlayerDrawn(state, currentId);
        const payload = action.payload ?? {};
        const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds.filter((id)=>Boolean(id)) : [];
        if (cardIds.length !== 6) return next;
        const meta = this.getMeta(next);
        const hand = Array.isArray(meta.hands?.[currentId]) ? [
            ...meta.hands[currentId]
        ] : [];
        if (!cardIds.every((cardId)=>hand.includes(cardId))) {
            return next;
        }
        let updatedMeta = this.removeCardsFromHand(meta, currentId, cardIds);
        const playerCircles = [
            ...updatedMeta.circles?.[currentId] ?? []
        ];
        const circleThemes = cardIds.reduce((acc, cardId)=>{
            const definition = _cerclessacrescards.CERCLES_SACRES_CARD_BY_ID[cardId];
            if (definition) {
                acc[definition.theme] = cardId;
            }
            return acc;
        }, {});
        const circle = {
            id: `circle-${currentId}-${playerCircles.length + 1}`,
            cards: cardIds,
            themes: circleThemes
        };
        playerCircles.push(circle);
        const circles = {
            ...updatedMeta.circles ?? {},
            [currentId]: playerCircles
        };
        updatedMeta = {
            ...updatedMeta,
            circles
        };
        next = this.setMeta(next, updatedMeta);
        const cardNames = cardIds.map((cardId)=>_cerclessacrescards.CERCLES_SACRES_CARD_BY_ID[cardId]?.name ?? cardId).join(', ');
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} pose son cercle sacré n°${playerCircles.length} (${cardNames}).`);
        next = this.fillHandToMinimum(next, currentId);
        if (playerCircles.length >= _cerclessacresstateentity.CERCLES_SACRES_GOAL) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} devient Gardien des Cercles avec ${_cerclessacresstateentity.CERCLES_SACRES_GOAL} cercles !`);
            const metaAfter = this.getMeta(next);
            return {
                ...next,
                status: 'finished',
                metadata: {
                    ...metaAfter,
                    winnerId: currentId
                }
            };
        }
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    fillHandToMinimum(state, playerId) {
        let meta = this.getMeta(state);
        let hand = Array.isArray(meta.hands?.[playerId]) ? [
            ...meta.hands[playerId]
        ] : [];
        if (hand.length >= _cerclessacresstateentity.CERCLES_SACRES_HAND_MIN) {
            return state;
        }
        const drawnCards = [];
        while(hand.length < _cerclessacresstateentity.CERCLES_SACRES_HAND_MIN){
            const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
            meta = updatedMeta;
            if (!cardId) break;
            drawnCards.push(cardId);
            hand = [
                ...hand,
                cardId
            ];
            const hands = {
                ...meta.hands ?? {}
            };
            hands[playerId] = hand;
            meta = {
                ...meta,
                hands
            };
        }
        let next = this.setMeta(state, meta);
        if (drawnCards.length) {
            const names = drawnCards.map((id)=>_cerclessacrescards.CERCLES_SACRES_CARD_BY_ID[id]?.name ?? 'une carte').join(', ');
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} complète sa main (${drawnCards.length} carte(s)) : ${names}.`);
        }
        return next;
    }
    ensurePlayerDrawn(state, playerId) {
        const meta = this.getMeta(state);
        if (meta.drawnPlayerId === playerId) return state;
        const { meta: updatedMeta, cardId } = this.drawForPlayer(meta, playerId);
        const next = this.setMeta(state, {
            ...updatedMeta,
            drawnPlayerId: playerId
        });
        if (cardId) {
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pioche ${_cerclessacrescards.CERCLES_SACRES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`);
        }
        return next;
    }
    drawForPlayer(meta, playerId) {
        const { cardId, meta: withCard } = this.drawOneCard(meta);
        if (!cardId) {
            return {
                meta: withCard,
                cardId: null
            };
        }
        const hands = {
            ...withCard.hands ?? {}
        };
        const playerHand = [
            ...hands[playerId] ?? []
        ];
        playerHand.push(cardId);
        hands[playerId] = playerHand;
        return {
            cardId,
            meta: {
                ...withCard,
                hands
            }
        };
    }
    drawOneCard(meta) {
        const draw = this.deckPolicies.drawOne({
            meta,
            deckKey: 'deck',
            discardKey: 'discard',
            rngKey: 'rng'
        });
        return {
            cardId: draw.card,
            meta: draw.meta
        };
    }
    removeCardsFromHand(meta, playerId, cardIds) {
        const hands = {
            ...meta.hands ?? {}
        };
        const playerHand = Array.isArray(hands[playerId]) ? [
            ...hands[playerId]
        ] : [];
        for (const cardId of cardIds){
            const index = playerHand.indexOf(cardId);
            if (index >= 0) {
                playerHand.splice(index, 1);
            }
        }
        hands[playerId] = playerHand;
        return {
            ...meta,
            hands
        };
    }
    removeCardFromHand(meta, playerId, cardId) {
        const hands = {
            ...meta.hands ?? {}
        };
        const playerHand = Array.isArray(hands[playerId]) ? [
            ...hands[playerId]
        ] : [];
        const index = playerHand.indexOf(cardId);
        if (index >= 0) {
            playerHand.splice(index, 1);
        }
        hands[playerId] = playerHand;
        return {
            ...meta,
            hands
        };
    }
    addCardToDiscard(meta, cardId) {
        const discard = [
            ...meta.discard ?? [],
            cardId
        ];
        return {
            ...meta,
            discard
        };
    }
    clearDrawn(state) {
        const meta = this.getMeta(state);
        return this.setMeta(state, {
            ...meta,
            drawnPlayerId: null
        });
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    setMeta(state, metadata) {
        return {
            ...state,
            metadata
        };
    }
    constructor(core, turns, deckPolicies){
        this.core = core;
        this.turns = turns;
        this.deckPolicies = deckPolicies;
    }
};
CerclesSacresActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], CerclesSacresActionService);
