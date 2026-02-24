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
exports.AbsurdissimesActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const deck_policies_service_1 = require("../../../../modules/deck-policies/services/deck-policies.service");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
let AbsurdissimesActionService = class AbsurdissimesActionService {
    core;
    deckPolicies;
    constructor(core, deckPolicies) {
        this.core = core;
        this.deckPolicies = deckPolicies;
    }
    applyActions(state, actions) {
        return (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                play_card: () => this.handlePlayCard(next, action),
                judge_pick: () => this.handleJudgePick(next, action),
            }, () => next);
        });
    }
    handlePlayCard(state, action) {
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        if (currentPlayerId == null)
            return state;
        let meta = this.getMeta(state);
        if (meta.roundStage !== 'play')
            return state;
        const payload = (action.payload ?? {});
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId)
            return state;
        const judgeId = this.getJudgeId(state, meta);
        if (judgeId === currentPlayerId)
            return state;
        const hand = Array.isArray(meta.blackHands?.[currentPlayerId])
            ? [...meta.blackHands[currentPlayerId]]
            : [];
        const cardIndex = hand.indexOf(cardId);
        if (cardIndex < 0)
            return state;
        hand.splice(cardIndex, 1);
        const submissions = {
            ...meta.submissions,
            [currentPlayerId]: cardId,
        };
        meta = {
            ...meta,
            blackHands: { ...meta.blackHands, [currentPlayerId]: hand },
            submissions,
            discardBlack: [...(meta.discardBlack ?? []), cardId],
        };
        const drawResult = this.drawBlackCard(meta, currentPlayerId);
        meta = drawResult.meta;
        const remainingPlayers = (meta.remainingPlayers ?? []).filter((pid) => pid !== currentPlayerId);
        meta = { ...meta, remainingPlayers };
        let next = this.setMeta(state, meta);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerName)(next.players, currentPlayerId)} propose ${cardId}.`);
        if (!remainingPlayers.length) {
            meta = { ...meta, roundStage: 'judge' };
            next = this.setMeta(next, meta);
            const judgeTurn = this.getJudgeId(next, meta);
            next = { ...next, turn: { currentPlayerId: judgeTurn, direction: 1 } };
            next = this.core.appendLog(next, 'Les cartes sont prêtes : le juge choisit la proposition gagnante.');
            return next;
        }
        next = {
            ...next,
            turn: { currentPlayerId: remainingPlayers[0], direction: 1 },
        };
        return next;
    }
    handleJudgePick(state, action) {
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        if (currentPlayerId == null)
            return state;
        let meta = this.getMeta(state);
        if (meta.roundStage !== 'judge')
            return state;
        const judgeId = this.getJudgeId(state, meta);
        if (judgeId !== currentPlayerId)
            return state;
        const payload = (action.payload ?? {});
        const winnerId = typeof payload.winnerId === 'number' ? payload.winnerId : null;
        if (winnerId == null)
            return state;
        if (!Object.prototype.hasOwnProperty.call(meta.submissions, winnerId))
            return state;
        const scores = { ...meta.scores };
        scores[winnerId] = (scores[winnerId] ?? 0) + 1;
        meta = { ...meta, scores };
        let next = this.core.appendLog(state, `${(0, player_name_helper_1.resolvePlayerName)(state.players, winnerId)} remporte la manche avec la réponse ${meta.submissions[winnerId] ?? ''}.`);
        const target = meta.targetScore;
        const hasWinner = scores[winnerId] >= target;
        meta = {
            ...meta,
            discardWhite: [...(meta.discardWhite ?? []), meta.currentWhite ?? ''],
            submissions: {},
            winnerId: hasWinner ? winnerId : null,
        };
        if (hasWinner) {
            next = this.setMeta({ ...next, status: 'finished' }, meta);
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerName)(next.players, winnerId)} atteint ${target} points !`);
            return next;
        }
        const prepared = this.prepareNextRound(next, meta);
        return prepared;
    }
    prepareNextRound(state, meta) {
        const players = this.getPlayerIds(state.players);
        if (!players.length)
            return state;
        const nextJudgeIndex = (meta.judgeIndex + 1) % players.length;
        const judgeId = players[nextJudgeIndex];
        const whiteResult = this.drawWhiteCard(meta);
        meta = {
            ...whiteResult.meta,
            judgeIndex: nextJudgeIndex,
            roundStage: 'play',
            submissions: {},
            currentWhite: whiteResult.card,
            remainingPlayers: players.filter((pid) => pid !== judgeId),
        };
        const nextPlayer = meta.remainingPlayers[0] ?? judgeId;
        const nextState = this.setMeta({ ...state, turn: { currentPlayerId: nextPlayer, direction: 1 } }, meta);
        nextState.log = [...nextState.log];
        return this.core.appendLog(nextState, `Nouvelle manche : ${(0, player_name_helper_1.resolvePlayerName)(nextState.players, judgeId)} est juge.`);
    }
    drawBlackCard(meta, playerId) {
        const draw = this.deckPolicies.drawOne({
            meta,
            deckKey: 'blackDeck',
            discardKey: 'discardBlack',
            rngKey: 'rng',
        });
        const cardId = draw.card;
        const hands = { ...draw.meta.blackHands };
        if (cardId) {
            const hand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
            hand.push(cardId);
            hands[playerId] = hand;
        }
        return {
            cardId,
            meta: {
                ...draw.meta,
                blackHands: hands,
            },
        };
    }
    drawWhiteCard(meta) {
        const draw = this.deckPolicies.drawOne({
            meta,
            deckKey: 'whiteDeck',
            discardKey: 'discardWhite',
            rngKey: 'rng',
        });
        return {
            card: draw.card,
            meta: {
                ...draw.meta,
            },
        };
    }
    getJudgeId(state, meta) {
        const players = this.getPlayerIds(state.players);
        if (!players.length)
            return null;
        const index = meta.judgeIndex % players.length;
        return players[index] ?? players[0] ?? null;
    }
    setMeta(state, metadata) {
        return { ...state, metadata };
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    getPlayerIds(players) {
        return (Array.isArray(players) ? players : [])
            .filter((player) => typeof player?.id === 'number')
            .map((player) => player.id);
    }
};
exports.AbsurdissimesActionService = AbsurdissimesActionService;
exports.AbsurdissimesActionService = AbsurdissimesActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        deck_policies_service_1.DeckPoliciesService])
], AbsurdissimesActionService);
//# sourceMappingURL=les-absurdissimes-action.service.js.map