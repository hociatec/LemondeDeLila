"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BandeABananeActionService", {
    enumerable: true,
    get: function() {
        return BandeABananeActionService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _labandeabananecards = require("../model/la-bande-a-banane-cards");
const _actionservicehelper = require("../../../../actions/action-service.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let BandeABananeActionService = class BandeABananeActionService {
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                play_card: ()=>this.handlePlayCard(next, action),
                pass: ()=>this.handlePass(next)
            }, ()=>next);
        });
    }
    handlePass(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let next = this.ensurePlayerDrawn(state, currentId);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} passe son tour.`);
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    handlePlayCard(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let next = this.ensurePlayerDrawn(state, currentId);
        const payload = action.payload ?? {};
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) return next;
        const definition = _labandeabananecards.BANDE_A_BANANE_CARD_BY_ID[cardId];
        if (!definition) return next;
        const meta = this.getMeta(next);
        if (!this.playerHasCard(meta, currentId, cardId)) return next;
        let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
        updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
        next = this.setMeta(next, updatedMeta);
        switch(definition.type){
            case 'monkey':
                next = this.playMonkey(next, currentId, definition);
                break;
            case 'joker':
                next = this.playJoker(next, currentId, definition, payload.species ?? null);
                break;
            case 'action':
                next = this.playAction(next, currentId, definition, payload);
                break;
            case 'trap':
                next = this.playTrap(next, currentId, definition);
                break;
        }
        next = this.enforceHandLimit(next, currentId);
        if ((this.getMeta(next).winnerId ?? null) != null) {
            return next;
        }
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    playMonkey(state, playerId, card) {
        return this.addCardToTroop(state, playerId, card.id, card.species ?? null, false);
    }
    playJoker(state, playerId, card, species) {
        return this.addCardToTroop(state, playerId, card.id, species, true);
    }
    playAction(state, playerId, card, payload) {
        if (card.action === 'vol-de-banane') {
            return this.playVol(state, playerId, payload.targetPlayerId ?? null);
        }
        if (card.action === 'cris-de-la-jungle') {
            return this.playCris(state, playerId, payload.targetPlayerId ?? null, payload.cardToGiveId ?? null);
        }
        if (card.action === 'grimpeur-fou') {
            return this.playGrimpeur(state, playerId);
        }
        return state;
    }
    playTrap(state, playerId, card) {
        if (card.trap === 'piege-a-noix-de-coco') {
            let next = this.addSkipTurns(state, playerId, 1);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} se prend une noix de coco et perd son prochain tour.`);
            return next;
        }
        if (card.trap === 'tigre-rodeur') {
            let next = this.discardRandomCard(state, playerId);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} chute sur un tigre et lâche une carte.`);
            return next;
        }
        return state;
    }
    playVol(state, playerId, targetId) {
        if (targetId == null) return state;
        const meta = this.getMeta(state);
        const targetHand = this.getPlayerHand(meta, targetId);
        if (!targetHand.length) return state;
        const { index, meta: updatedRng } = this.random.pickIndex(meta.rng ?? {}, targetHand.length);
        const stolen = targetHand[index];
        let nextMeta = {
            ...meta,
            rng: updatedRng
        };
        nextMeta = this.removeCardFromHand(nextMeta, targetId, stolen);
        nextMeta = this.addCardToHand(nextMeta, playerId, stolen);
        let next = this.setMeta(state, nextMeta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} vole ${this.getCardName(stolen)} à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)}.`);
        return next;
    }
    playCris(state, playerId, targetId, giveCardId) {
        if (targetId == null || !giveCardId) return state;
        let next = state;
        let nextMeta = this.getMeta(next);
        if (!this.playerHasCard(nextMeta, playerId, giveCardId)) {
            return next;
        }
        nextMeta = this.removeCardFromHand(nextMeta, playerId, giveCardId);
        const originalTargetHand = this.getPlayerHand(nextMeta, targetId);
        if (originalTargetHand.length) {
            const { index, meta: updatedRng } = this.random.pickIndex(nextMeta.rng ?? {}, originalTargetHand.length);
            const returned = originalTargetHand[index];
            nextMeta = {
                ...nextMeta,
                rng: updatedRng
            };
            nextMeta = this.removeCardFromHand(nextMeta, targetId, returned);
            nextMeta = this.addCardToHand(nextMeta, playerId, returned);
            nextMeta = this.addCardToHand(nextMeta, targetId, giveCardId);
            next = this.setMeta(next, nextMeta);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} échange ${this.getCardName(returned)} avec ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)}.`);
            return next;
        }
        nextMeta = this.addCardToHand(nextMeta, targetId, giveCardId);
        next = this.setMeta(next, nextMeta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} donne une carte à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)}.`);
        return next;
    }
    playGrimpeur(state, playerId) {
        let next = state;
        let nextMeta = this.getMeta(next);
        for(let i = 0; i < 2; i += 1){
            const { cardId, meta: updatedMeta } = this.drawForPlayer(nextMeta, playerId);
            nextMeta = updatedMeta;
            next = this.setMeta(next, nextMeta);
            if (cardId) {
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} grimpe et pioche ${this.getCardName(cardId)}.`);
            }
        }
        return next;
    }
    addCardToTroop(state, playerId, cardId, species, isJoker) {
        if (!species) return state;
        const meta = this.getMeta(state);
        const troops = {
            ...meta.troops ?? {}
        };
        const playerTroop = [
            ...troops[playerId] ?? []
        ];
        playerTroop.push({
            cardId,
            species,
            isJoker
        });
        troops[playerId] = playerTroop;
        let next = this.setMeta(state, {
            ...meta,
            troops
        });
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} joue ${this.getCardName(cardId)} dans sa troupe.${isJoker ? ' (joker)' : ''}`);
        if (this.hasWinningTroupe(this.getMeta(next), playerId)) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} crie à BANAAAANE ! à et devient le chef de la Bande à Banane !`);
            next = {
                ...next,
                status: 'finished',
                metadata: {
                    ...this.getMeta(next),
                    winnerId: playerId
                }
            };
        }
        return next;
    }
    enforceHandLimit(state, playerId) {
        let next = state;
        let nextMeta = this.getMeta(next);
        let hand = this.getPlayerHand(nextMeta, playerId);
        while(hand.length > BandeABananeActionService.HAND_LIMIT){
            const { index, meta: updatedRng } = this.random.pickIndex(nextMeta.rng ?? {}, hand.length);
            const cardId = hand[index];
            nextMeta = {
                ...nextMeta,
                rng: updatedRng
            };
            nextMeta = this.removeCardFromHand(nextMeta, playerId, cardId);
            nextMeta = this.addCardToDiscard(nextMeta, cardId);
            next = this.setMeta(next, nextMeta);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} dépasse 7 cartes et défausse ${this.getCardName(cardId)}.`);
            hand = this.getPlayerHand(nextMeta, playerId);
        }
        return next;
    }
    addSkipTurns(state, playerId, amount) {
        const meta = this.getMeta(state);
        const statuses = meta.statuses ?? {
            skipTurn: {}
        };
        const skipTurn = {
            ...statuses.skipTurn ?? {}
        };
        const current = skipTurn[playerId] ?? 0;
        skipTurn[playerId] = current + amount;
        const nextMeta = {
            ...meta,
            statuses: {
                ...statuses,
                skipTurn
            }
        };
        return this.setMeta(state, nextMeta);
    }
    discardRandomCard(state, playerId) {
        let next = state;
        let meta = this.getMeta(next);
        const hand = this.getPlayerHand(meta, playerId);
        if (!hand.length) return next;
        const { index, meta: updatedRng } = this.random.pickIndex(meta.rng ?? {}, hand.length);
        const cardId = hand[index];
        meta = {
            ...meta,
            rng: updatedRng
        };
        meta = this.removeCardFromHand(meta, playerId, cardId);
        meta = this.addCardToDiscard(meta, cardId);
        next = this.setMeta(next, meta);
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
            meta: {
                ...withCard,
                hands
            },
            cardId
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
            meta: draw.meta,
            cardId: draw.card
        };
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
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pioche ${this.getCardName(cardId)}.`);
        }
        return next;
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
    playerHasCard(meta, playerId, cardId) {
        const hand = this.getPlayerHand(meta, playerId);
        return hand.includes(cardId);
    }
    getPlayerHand(meta, playerId) {
        return Array.isArray(meta.hands?.[playerId]) ? meta.hands[playerId] : [];
    }
    addCardToHand(meta, playerId, cardId) {
        const hands = {
            ...meta.hands ?? {}
        };
        const playerHand = [
            ...hands[playerId] ?? []
        ];
        playerHand.push(cardId);
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
        const playerHand = [
            ...hands[playerId] ?? []
        ];
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
    getCardName(cardId) {
        return _labandeabananecards.BANDE_A_BANANE_CARD_BY_ID[cardId]?.name ?? 'une carte';
    }
    hasWinningTroupe(meta, playerId) {
        const entries = Array.isArray(meta.troops?.[playerId]) ? meta.troops[playerId] : [];
        const species = new Set(entries.map((entry)=>entry.species));
        return species.size >= 5;
    }
    constructor(core, turns, random, deckPolicies){
        this.core = core;
        this.turns = turns;
        this.random = random;
        this.deckPolicies = deckPolicies;
    }
};
BandeABananeActionService.HAND_LIMIT = 7;
BandeABananeActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], BandeABananeActionService);
