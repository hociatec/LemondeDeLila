"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OlympiaActionService", {
    enumerable: true,
    get: function() {
        return OlympiaActionService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _olympiacards = require("../model/olympia-cards");
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
const VICTORY_PRESTIGE = 30;
let OlympiaActionService = class OlympiaActionService {
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                draw_card: ()=>this.handleDrawCard(next, action),
                play_card: ()=>this.handlePlayCard(next, action),
                pass: ()=>this.handlePass(next)
            }, ()=>next);
        });
    }
    handlePass(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let next = this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, currentId)} passe son tour.`);
        next = this.advanceAndTick(next);
        return next;
    }
    handleDrawCard(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const payload = action.payload ?? {};
        const deck = payload.deck ?? 'heros';
        let next = state;
        const meta = this.getMeta(next);
        const entry = this.drawOneCard(meta, deck);
        if (!entry.cardId) {
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} n'a plus de cartes dans le deck ${deck}.`);
        }
        const updatedMeta = this.addCardToHand({
            ...entry.meta,
            rng: entry.meta.rng
        }, currentId, entry.cardId);
        next = this.setMeta(next, updatedMeta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} pioche ${this.getCardName(entry.cardId)} (${deck}).`);
        next = this.checkVictory(next, currentId);
        return next;
    }
    handlePlayCard(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const payload = action.payload ?? {};
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) return state;
        const definition = _olympiacards.OLYMPIA_CARD_BY_ID[cardId];
        if (!definition) return state;
        const meta = this.getMeta(state);
        const hand = Array.isArray(meta.hands?.[currentId]) ? meta.hands[currentId] : [];
        if (!hand.includes(cardId)) return state;
        let nextMeta = this.removeCardFromHand(meta, currentId, cardId);
        nextMeta = this.addCardToDiscard(nextMeta, cardId);
        let next = this.setMeta(state, nextMeta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} joue ${definition.name}.`);
        if (definition.points) {
            next = this.addPrestige(next, currentId, definition.points);
        }
        if (definition.effect) {
            const effects = Array.isArray(definition.effect) ? definition.effect : [
                definition.effect
            ];
            for (const effect of effects){
                next = this.applyEffect(next, currentId, effect, payload.targetPlayerId ?? null);
            }
        }
        if (this.getMeta(next).winnerId != null) {
            return next;
        }
        next = this.advanceAndTick(next);
        return next;
    }
    applyEffect(state, actorId, effect, targetId) {
        let next = state;
        if (effect.type === 'prestige') {
            const targets = this.resolveTargets(next, actorId, targetId, effect.target);
            for (const tid of targets){
                next = this.addPrestige(next, tid, effect.value);
            }
        } else if (effect.type === 'steal') {
            next = this.applySteal(next, actorId, effect.value);
        } else if (effect.type === 'draw') {
            const targets = this.resolveTargets(next, actorId, targetId, effect.target);
            for (const tid of targets){
                next = this.drawForPlayer(next, tid, effect.amount, effect.decks);
            }
        } else if (effect.type === 'status') {
            const targets = this.resolveTargets(next, actorId, targetId, effect.target);
            for (const tid of targets){
                next = this.addStatus(next, tid, {
                    key: effect.key,
                    turns: effect.turns,
                    value: effect.value
                });
            }
        } else if (effect.type === 'discard') {
            const targets = this.resolveTargets(next, actorId, targetId, effect.target);
            for (const tid of targets){
                next = this.discardRandom(next, tid, effect.amount);
            }
        } else if (effect.type === 'exchange') {
            if (targetId != null) {
                next = this.exchangeCard(next, actorId, targetId, effect.categories);
            }
        } else if (effect.type === 'skip') {
            if (targetId != null) {
                next = this.addSkip(next, targetId, effect.turns);
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)} doit passer ${effect.turns} tour(s).`);
            }
        }
        return next;
    }
    resolveTargets(state, actorId, explicitTarget, descriptor) {
        const players = Array.isArray(state.players) ? state.players : [];
        const ids = players.filter((p)=>p?.id != null).map((p)=>p.id);
        if (descriptor === 'self') return [
            actorId
        ];
        if (descriptor === 'target' && explicitTarget != null) return [
            explicitTarget
        ];
        if (descriptor === 'all') return ids;
        if (descriptor === 'others') return ids.filter((id)=>id !== actorId);
        return [];
    }
    addPrestige(state, playerId, amount) {
        if (amount === 0) return state;
        const meta = this.getMeta(state);
        const prestige = {
            ...meta.prestige ?? {}
        };
        prestige[playerId] = (prestige[playerId] ?? 0) + amount;
        let next = this.setMeta(state, {
            ...meta,
            prestige
        });
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} ${amount >= 0 ? 'gagne' : 'perd'} ${Math.abs(amount)} point(s) de prestige.`);
        return this.checkVictory(next, playerId);
    }
    addStatus(state, playerId, status) {
        const meta = this.getMeta(state);
        const statuses = {
            ...meta.statuses ?? {}
        };
        const playerStatuses = [
            ...statuses[playerId] ?? []
        ];
        playerStatuses.push(status);
        statuses[playerId] = playerStatuses;
        return this.setMeta(state, {
            ...meta,
            statuses
        });
    }
    addSkip(state, playerId, turns) {
        const meta = this.getMeta(state);
        const skipTurn = {
            ...meta.skipTurn ?? {}
        };
        skipTurn[playerId] = (skipTurn[playerId] ?? 0) + turns;
        return this.setMeta(state, {
            ...meta,
            skipTurn
        });
    }
    discardRandom(state, playerId, amount) {
        const meta = this.getMeta(state);
        const hand = Array.isArray(meta.hands?.[playerId]) ? [
            ...meta.hands[playerId]
        ] : [];
        if (!hand.length) return state;
        const discardList = [
            ...meta.discard ?? []
        ];
        const removed = [];
        for(let i = 0; i < amount && hand.length; i += 1){
            const cardId = hand.shift();
            discardList.push(cardId);
            removed.push(cardId);
        }
        const next = this.setMeta(state, {
            ...meta,
            hands: {
                ...meta.hands,
                [playerId]: hand
            },
            discard: discardList
        });
        if (removed.length) {
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} défausse ${removed.length} carte(s).`);
        }
        return next;
    }
    exchangeCard(state, actorId, targetId, categories) {
        const meta = this.getMeta(state);
        const actorHand = Array.isArray(meta.hands?.[actorId]) ? [
            ...meta.hands[actorId]
        ] : [];
        const targetHand = Array.isArray(meta.hands?.[targetId]) ? [
            ...meta.hands[targetId]
        ] : [];
        const actorCard = actorHand.find((cardId)=>categories.includes(_olympiacards.OLYMPIA_CARD_BY_ID[cardId]?.category));
        const targetCard = targetHand.shift();
        if (!actorCard || !targetCard) return state;
        actorHand.splice(actorHand.indexOf(actorCard), 1);
        actorHand.push(targetCard);
        targetHand.push(actorCard);
        return this.setMeta(state, {
            ...meta,
            hands: {
                ...meta.hands,
                [actorId]: actorHand,
                [targetId]: targetHand
            }
        });
    }
    applySteal(state, actorId, amount) {
        const players = Array.isArray(state.players) ? state.players : [];
        const opponents = players.filter((p)=>p?.id != null && p.id !== actorId);
        if (!opponents.length) return state;
        const target = opponents[0];
        let next = this.addPrestige(state, actorId, amount);
        next = this.addPrestige(next, target.id, -amount);
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, actorId)} vole ${amount} point(s) à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, target.id)}.`);
    }
    drawForPlayer(state, playerId, amount, decks) {
        let next = state;
        for(let i = 0; i < amount; i += 1){
            for (const deck of decks){
                const meta = this.getMeta(next);
                const entry = this.drawOneCard(meta, deck);
                if (!entry.cardId) continue;
                next = this.setMeta(next, this.addCardToHand(entry.meta, playerId, entry.cardId));
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pioche ${this.getCardName(entry.cardId)} (${deck}).`);
                break;
            }
        }
        return next;
    }
    drawOneCard(meta, deck) {
        const pile = [
            ...meta.decks?.[deck] ?? []
        ];
        if (!pile.length) {
            return {
                cardId: null,
                meta
            };
        }
        const [cardId, ...rest] = pile;
        const nextMeta = {
            ...meta,
            decks: {
                ...meta.decks,
                [deck]: rest
            }
        };
        return {
            cardId,
            meta: nextMeta
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
    checkVictory(state, playerId) {
        const meta = this.getMeta(state);
        const prestige = meta.prestige ?? {};
        if ((prestige[playerId] ?? 0) >= VICTORY_PRESTIGE) {
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
    advanceAndTick(state) {
        let next = this.turns.advanceTurn(state);
        next = this.cleanStatuses(next);
        return next;
    }
    cleanStatuses(state) {
        const meta = this.getMeta(state);
        const statuses = {};
        for (const [playerId, list] of Object.entries(meta.statuses ?? {})){
            const reduced = (list ?? []).map((entry)=>({
                    ...entry,
                    turns: entry.turns - 1
                })).filter((entry)=>entry.turns > 0);
            statuses[Number(playerId)] = reduced;
        }
        return this.setMeta(state, {
            ...meta,
            statuses
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
    getCardName(cardId) {
        return _olympiacards.OLYMPIA_CARD_BY_ID[cardId]?.name ?? cardId;
    }
    constructor(core, turns){
        this.core = core;
        this.turns = turns;
    }
};
OlympiaActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService
    ])
], OlympiaActionService);
