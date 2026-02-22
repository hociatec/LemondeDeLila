"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaParadeSucreeActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const la_parade_sucree_cards_1 = require("../model/la-parade-sucree-cards");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
let LaParadeSucreeActionService = class LaParadeSucreeActionService {
    core;
    turns;
    constructor(core, turns) {
        this.core = core;
        this.turns = turns;
    }
    applyActions(state, actions) {
        return (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                play_card: () => this.handlePlayCard(next, action),
                pass: () => this.handlePass(next),
            }, () => next);
        });
    }
    handlePlayCard(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null)
            return state;
        const payload = (action.payload ?? {});
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId)
            return state;
        const definition = la_parade_sucree_cards_1.LA_PARADE_CARD_BY_ID[cardId];
        if (!definition)
            return state;
        const meta = this.getMeta(state);
        const hand = Array.isArray(meta.hands?.[currentId])
            ? meta.hands[currentId]
            : [];
        if (!hand.includes(cardId))
            return state;
        const sequenceValue = la_parade_sucree_cards_1.LA_PARADE_SEQUENCE[meta.sequenceIndex];
        if (definition.value !== sequenceValue) {
            return state;
        }
        let nextMeta = this.removeCardFromHand(meta, currentId, cardId);
        nextMeta = this.addPlayed(nextMeta, cardId);
        nextMeta = { ...nextMeta, sequenceIndex: meta.sequenceIndex + 1 };
        let next = this.setMeta(state, nextMeta);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} pose ${definition.name} (${definition.value}).`);
        if (definition.special) {
            next = this.applySpecialReward(next, currentId, definition.value);
        }
        const updatedMeta = this.getMeta(next);
        if (this.isGameFinished(updatedMeta)) {
            return this.finishGame(next);
        }
        return next;
    }
    handlePass(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null)
            return state;
        let next = this.core.appendLog(state, `${(0, player_name_helper_1.resolvePlayerNameFromState)(state, currentId)} passe son tour.`);
        next = this.turns.advanceTurn(next);
        return next;
    }
    applySpecialReward(state, playerId, value) {
        const reward = la_parade_sucree_cards_1.LA_PARADE_SPECIAL_REWARDS[value];
        if (!reward)
            return state;
        const meta = this.getMeta(state);
        const candies = { ...(meta.candies ?? {}) };
        const playerCandies = {
            ...(candies[playerId] ?? { Chamallow: 0, Chocobon: 0, Balisto: 0 }),
        };
        for (const [type, amount] of Object.entries(reward)) {
            const candyType = type;
            playerCandies[candyType] =
                (playerCandies[candyType] ?? 0) + (amount ?? 0);
        }
        candies[playerId] = playerCandies;
        let next = this.setMeta(state, { ...meta, candies });
        const gainValue = this.computeCandyValue(reward);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} rafle les friandises de la case ${value} (+${gainValue}).`);
        return next;
    }
    computeCandyValue(reward) {
        let total = 0;
        for (const [key, amount] of Object.entries(reward)) {
            const candyType = key;
            total += (la_parade_sucree_cards_1.CANDY_VALUES[candyType] ?? 0) * (amount ?? 0);
        }
        return total;
    }
    addPlayed(meta, cardId) {
        const played = [...(meta.played ?? []), cardId];
        return { ...meta, played };
    }
    removeCardFromHand(meta, playerId, cardId) {
        const hands = { ...(meta.hands ?? {}) };
        const playerHand = Array.isArray(hands[playerId])
            ? [...hands[playerId]]
            : [];
        const index = playerHand.indexOf(cardId);
        if (index >= 0) {
            playerHand.splice(index, 1);
        }
        hands[playerId] = playerHand;
        return { ...meta, hands };
    }
    isGameFinished(meta) {
        const allPlayed = meta.sequenceIndex >= la_parade_sucree_cards_1.LA_PARADE_SEQUENCE.length;
        const noCardsLeft = Object.values(meta.hands ?? {}).every((hand) => Array.isArray(hand) && hand.length === 0);
        return allPlayed || noCardsLeft;
    }
    finishGame(state) {
        const meta = this.getMeta(state);
        const winnerId = this.determineWinner(meta);
        const next = {
            ...state,
            status: 'finished',
            metadata: { ...meta, winnerId },
        };
        return this.core.appendLog(next, winnerId
            ? `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, winnerId)} rafle la Parade Sucrée !`
            : 'Match nul gourmand !');
    }
    determineWinner(meta) {
        let bestId = null;
        let bestScore = -Infinity;
        let tie = false;
        for (const [playerIdStr, candies] of Object.entries(meta.candies ?? {})) {
            const playerId = Number(playerIdStr);
            const value = this.scoreCandies(candies);
            if (value > bestScore) {
                bestScore = value;
                bestId = playerId;
                tie = false;
                continue;
            }
            if (value === bestScore) {
                tie = true;
            }
        }
        return tie ? null : bestId;
    }
    scoreCandies(candies) {
        if (!candies)
            return 0;
        let total = 0;
        for (const [type, amount] of Object.entries(candies)) {
            const candyType = type;
            total += (la_parade_sucree_cards_1.CANDY_VALUES[candyType] ?? 0) * (amount ?? 0);
        }
        return total;
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    setMeta(state, metadata) {
        return { ...state, metadata };
    }
};
exports.LaParadeSucreeActionService = LaParadeSucreeActionService;
exports.LaParadeSucreeActionService = LaParadeSucreeActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        turn_flow_service_1.TurnFlowService])
], LaParadeSucreeActionService);
//# sourceMappingURL=la-parade-sucree-action.service.js.map