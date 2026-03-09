"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DameNatureActionService", {
    enumerable: true,
    get: function() {
        return DameNatureActionService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _damenaturecards = require("../model/dame-nature-cards");
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
let DameNatureActionService = class DameNatureActionService {
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                ask_card: ()=>this.handleAskCard(next, action),
                pass: ()=>this.handlePass(next)
            }, ()=>next);
        });
    }
    handlePass(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const next = this.turns.advanceTurn(state);
        return next;
    }
    handleAskCard(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const payload = action.payload ?? {};
        const targetId = payload.targetPlayerId ?? null;
        const cardId = String(payload.cardId ?? '').trim();
        if (!targetId || !cardId) return state;
        const cardDefinition = _damenaturecards.DAME_NATURE_CARD_BY_ID[cardId];
        if (!cardDefinition || cardDefinition.type !== 'family') return state;
        const meta = this.getMeta(state);
        if (!this.playerHasCard(meta, targetId, cardId)) {
            return this.drawAndAdvance(state, currentId, `La carte ${this.getCardName(cardId)} n'est pas chez le joueur demandé.`);
        }
        let next = this.transferCardBetweenPlayers(state, targetId, currentId, cardId);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} récupère ${this.getCardName(cardId)} de ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)}.`);
        next = this.registerFamilyCard(next, currentId, cardId);
        next = this.checkVictory(next, currentId);
        return next;
    }
    drawAndAdvance(state, playerId, reason) {
        let next = this.core.appendLog(state, reason);
        next = this.drawCardForPlayer(next, playerId);
        if (this.isGameFinished(next)) return next;
        next = this.turns.advanceTurn(next);
        return next;
    }
    drawCardForPlayer(state, playerId) {
        const meta = this.getMeta(state);
        const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
        let next = this.setMeta(state, updatedMeta);
        if (!cardId) {
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} ne trouve plus aucune carte à piocher.`);
        }
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pioche ${this.getCardName(cardId)}.`);
        const definition = _damenaturecards.DAME_NATURE_CARD_BY_ID[cardId];
        if (!definition) return next;
        if (definition.type === 'family') {
            next = this.addCardToHand(next, playerId, cardId);
            next = this.registerFamilyCard(next, playerId, cardId);
            next = this.checkVictory(next, playerId);
            return next;
        }
        if (definition.type === 'quiz') {
            next = this.addCardToDiscard(next, cardId);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} lit le quiz : ${definition.question}`);
            next = this.setLastQuiz(next, cardId);
            return next;
        }
        if (definition.type === 'nature') {
            next = this.addCardToDiscard(next, cardId);
            next = this.applyNatureEffect(next, playerId, definition.delta, definition.description);
            return next;
        }
        return next;
    }
    registerFamilyCard(state, playerId, cardId) {
        const meta = this.getMeta(state);
        const definition = _damenaturecards.DAME_NATURE_CARD_BY_ID[cardId];
        if (!definition || definition.type !== 'family') return state;
        const familyId = definition.familyId;
        const families = {
            ...meta.families ?? {}
        };
        const playerFamilies = {
            ...families[playerId] ?? {}
        };
        const list = [
            ...playerFamilies[familyId] ?? []
        ];
        if (!list.includes(cardId)) {
            list.push(cardId);
        }
        playerFamilies[familyId] = list;
        families[playerId] = playerFamilies;
        return this.setMeta(state, {
            ...meta,
            families
        });
    }
    transferCardBetweenPlayers(state, fromId, toId, cardId) {
        let next = this.removeCardFromHand(state, fromId, cardId);
        next = this.addCardToHand(this.setMeta(next, this.removeFamilyCard(this.getMeta(next), fromId, cardId)), toId, cardId);
        return next;
    }
    applyNatureEffect(state, playerId, delta, description) {
        let next = state;
        let meta = this.getMeta(next);
        const current = Math.max(0, (meta.pollutionTokens ?? 0) + delta);
        const pollution = Math.min(12, current);
        meta = {
            ...meta,
            pollutionTokens: pollution
        };
        next = this.setMeta(next, meta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} subit : ${description} (${delta >= 0 ? '+' : ''}${delta} jetons pollution).`);
        if (pollution >= 12) {
            next = {
                ...next,
                status: 'finished',
                metadata: {
                    ...meta,
                    winnerId: null,
                    pollutionLoserId: playerId
                }
            };
        }
        return next;
    }
    checkVictory(state, playerId) {
        if (this.isGameFinished(state)) return state;
        const completed = this.getCompletedFamilyCount(this.getMeta(state), playerId);
        if (completed >= 4) {
            const meta = this.getMeta(state);
            return {
                ...state,
                status: 'finished',
                metadata: {
                    ...meta,
                    winnerId: playerId
                }
            };
        }
        return state;
    }
    getCompletedFamilyCount(meta, playerId) {
        const playerFamilies = meta.families?.[playerId] ?? {};
        return Object.values(playerFamilies).filter((cards)=>cards.length >= 6).length;
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
    addCardToHand(state, playerId, cardId) {
        const meta = this.getMeta(state);
        const hands = {
            ...meta.hands ?? {}
        };
        const playerHand = [
            ...hands[playerId] ?? []
        ];
        playerHand.push(cardId);
        hands[playerId] = playerHand;
        return this.setMeta(state, {
            ...meta,
            hands
        });
    }
    removeCardFromHand(state, playerId, cardId) {
        const meta = this.getMeta(state);
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
        return this.setMeta(state, {
            ...meta,
            hands
        });
    }
    addCardToDiscard(state, cardId) {
        const meta = this.getMeta(state);
        const discard = [
            ...meta.discard ?? [],
            cardId
        ];
        return this.setMeta(state, {
            ...meta,
            discard
        });
    }
    removeFamilyCard(meta, playerId, cardId) {
        const definition = _damenaturecards.DAME_NATURE_CARD_BY_ID[cardId];
        if (!definition || definition.type !== 'family') return meta;
        const families = {
            ...meta.families ?? {}
        };
        const playerFamilies = {
            ...families[playerId] ?? {}
        };
        const familyId = definition.familyId;
        const playerCards = [
            ...playerFamilies[familyId] ?? []
        ];
        const index = playerCards.indexOf(cardId);
        if (index >= 0) {
            playerCards.splice(index, 1);
        }
        playerFamilies[familyId] = playerCards;
        families[playerId] = playerFamilies;
        return {
            ...meta,
            families
        };
    }
    setLastQuiz(state, cardId) {
        const meta = this.getMeta(state);
        return this.setMeta(state, {
            ...meta,
            lastQuizCardId: cardId
        });
    }
    setMeta(state, metadata) {
        return {
            ...state,
            metadata
        };
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    playerHasCard(meta, playerId, cardId) {
        return Array.isArray(meta.hands?.[playerId]) && meta.hands[playerId].includes(cardId);
    }
    getCardName(cardId) {
        const definition = _damenaturecards.DAME_NATURE_CARD_BY_ID[cardId];
        if (!definition) return cardId;
        if (definition.type === 'family') {
            return `${definition.familyName} (${definition.memberName})`;
        }
        if (definition.type === 'quiz') {
            return `Quiz : ${definition.question}`;
        }
        if (definition.type === 'nature') {
            return `Nature : ${definition.description}`;
        }
        return cardId;
    }
    isGameFinished(state) {
        return String(state.status ?? '').toLowerCase() === 'finished';
    }
    constructor(core, turns, deckPolicies){
        this.core = core;
        this.turns = turns;
        this.deckPolicies = deckPolicies;
    }
};
DameNatureActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], DameNatureActionService);
