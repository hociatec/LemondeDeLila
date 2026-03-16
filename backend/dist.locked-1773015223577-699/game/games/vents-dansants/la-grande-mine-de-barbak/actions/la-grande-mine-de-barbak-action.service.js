"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LaGrandeMineDeBarbakActionService", {
    enumerable: true,
    get: function() {
        return LaGrandeMineDeBarbakActionService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _lagrandeminecards = require("../model/la-grande-mine-cards");
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
let LaGrandeMineDeBarbakActionService = class LaGrandeMineDeBarbakActionService {
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
        next = this.trimHand(next, currentId);
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
        const meta = this.getMeta(next);
        const hand = Array.isArray(meta.hands?.[currentId]) ? [
            ...meta.hands[currentId]
        ] : [];
        if (!hand.includes(cardId)) return next;
        const updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
        next = this.setMeta(next, updatedMeta);
        next = this.addCardToDiscard(next, cardId);
        const definition = _lagrandeminecards.LA_GRANDE_MINE_CARD_BY_ID[cardId];
        if (!definition) return next;
        if (definition.category === 'tresor') {
            next = this.playTreasure(next, currentId, cardId, definition);
        } else if (definition.category === 'objet') {
            next = this.playObject(next, currentId, cardId, definition);
        } else if (definition.category === 'event') {
            next = this.applyEventEffect(next, currentId, definition, true);
        } else if (definition.category === 'monster') {
            const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
            next = this.applyMonsterEffect(next, currentId, targetId, definition);
        } else if (definition.category === 'collapse') {
            next = this.applyCollapseEffect(next, definition.id, currentId, true);
        }
        if (this.getMeta(next).winnerId != null) {
            return next;
        }
        next = this.trimHand(next, currentId);
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    ensurePlayerDrawn(state, playerId) {
        const meta = this.getMeta(state);
        if (meta.drawnPlayerId === playerId) return state;
        const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
        let next = this.setMeta(state, {
            ...updatedMeta,
            drawnPlayerId: playerId
        });
        if (!cardId) {
            return next;
        }
        const definition = _lagrandeminecards.LA_GRANDE_MINE_CARD_BY_ID[cardId];
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pioche ${definition?.name ?? 'une carte'}.`);
        if (!definition) {
            return next;
        }
        if (definition.category === 'event') {
            next = this.addCardToDiscard(next, cardId);
            next = this.applyEventEffect(next, playerId, definition, false);
        } else if (definition.category === 'monster') {
            next = this.addCardToDiscard(next, cardId);
            next = this.applyMonsterEffect(next, playerId, null, definition);
        } else if (definition.category === 'collapse') {
            next = this.addCardToDiscard(next, cardId);
            next = this.applyCollapseEffect(next, definition.id, playerId, false);
        } else {
            next = this.addCardToHand(next, playerId, cardId);
        }
        return next;
    }
    playTreasure(state, playerId, cardId, card) {
        const meta = this.getMeta(state);
        const domains = {
            ...meta.domains ?? {}
        };
        const domain = domains[playerId] ?? {
            treasures: [],
            objects: []
        };
        const treasures = [
            ...domain.treasures ?? [],
            cardId
        ];
        domains[playerId] = {
            ...domain,
            treasures
        };
        let next = this.setMeta(state, {
            ...meta,
            domains
        });
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pose le trésor ${card.name} (+${card.points ?? 0} pts).`);
        return next;
    }
    playObject(state, playerId, cardId, card) {
        const meta = this.getMeta(state);
        const domains = {
            ...meta.domains ?? {}
        };
        const domain = domains[playerId] ?? {
            treasures: [],
            objects: []
        };
        const objects = [
            ...domain.objects ?? [],
            cardId
        ];
        domains[playerId] = {
            ...domain,
            objects
        };
        let next = this.setMeta(state, {
            ...meta,
            domains
        });
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} installe l'objet ${card.name}.`);
        return next;
    }
    applyEventEffect(state, playerId, card, played) {
        const message = played ? `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} utilise ${card.name} (${card.description}).` : `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} déclenche ${card.name} (${card.description}).`;
        return this.core.appendLog(state, message);
    }
    applyMonsterEffect(state, playerId, targetId, card) {
        let meta = this.getMeta(state);
        const opponents = this.availableOpponents(state, playerId);
        let chosenId = null;
        if (targetId != null && opponents.includes(targetId)) {
            chosenId = targetId;
        } else if (opponents.length) {
            const { value, meta: updatedRng } = this.random.pickOne(meta.rng ?? {}, opponents);
            meta = {
                ...meta,
                rng: updatedRng
            };
            chosenId = value ?? null;
        }
        let next = this.setMeta(state, meta);
        if (chosenId == null) {
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} tente de lancer ${card.name}, mais il n'y a personne.`);
        }
        next = this.removeRandomDomainCard(next, chosenId);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} attaque ${(0, _playernamehelper.resolvePlayerNameFromState)(next, chosenId)} avec ${card.name}.`);
        return next;
    }
    applyCollapseEffect(state, cardId, playerId, played) {
        let next = state;
        if (cardId === 'barbak-collapse-1') {
            next = this.applyMinorCollapse(next);
        } else if (cardId === 'barbak-collapse-2') {
            next = this.applyMajorCollapse(next);
        } else if (cardId === 'barbak-collapse-3' || cardId === 'barbak-collapse-4') {
            next = this.finishGame(next);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} déclenche un effondrement final !`);
        }
        if (played) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} joue l'effondrement ${cardId}.`);
        }
        return next;
    }
    applyMinorCollapse(state) {
        let next = state;
        const players = Array.isArray(state.players) ? state.players : [];
        for (const player of players){
            if (player?.id == null) continue;
            next = this.discardRandomFromHand(next, player.id, 1);
        }
        return this.core.appendLog(next, 'Un éboulement mineur secoue la mine !');
    }
    applyMajorCollapse(state) {
        let next = state;
        const players = Array.isArray(state.players) ? state.players : [];
        for (const player of players){
            if (player?.id == null) continue;
            next = this.removeRandomTreasure(next, player.id, 2);
        }
        return this.core.appendLog(next, 'Un éboulement majeur fait voler les trésors !');
    }
    discardRandomFromHand(state, playerId, count) {
        let next = state;
        for(let i = 0; i < count; i += 1){
            const meta = this.getMeta(next);
            const hand = Array.isArray(meta.hands?.[playerId]) ? [
                ...meta.hands[playerId]
            ] : [];
            if (!hand.length) break;
            const { index, meta: updatedRng } = this.random.pickIndex(meta.rng ?? {}, hand.length);
            const cardId = hand.splice(index, 1)[0];
            next = this.setMeta(next, {
                ...meta,
                rng: updatedRng,
                hands: {
                    ...meta.hands ?? {},
                    [playerId]: hand
                }
            });
            if (cardId) {
                next = this.addCardToDiscard(next, cardId);
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} défausse ${cardId}.`);
            }
        }
        return next;
    }
    removeRandomTreasure(state, playerId, count) {
        let next = state;
        for(let i = 0; i < count; i += 1){
            const meta = this.getMeta(next);
            const domain = (meta.domains ?? {})[playerId];
            const treasures = Array.isArray(domain?.treasures) ? [
                ...domain.treasures
            ] : [];
            if (!treasures.length) break;
            const { index, meta: updatedRng } = this.random.pickIndex(meta.rng ?? {}, treasures.length);
            const [cardId] = treasures.splice(index, 1);
            next = this.setMeta(next, {
                ...meta,
                rng: updatedRng,
                domains: {
                    ...meta.domains ?? {},
                    [playerId]: {
                        ...meta.domains?.[playerId] ?? {
                            treasures: [],
                            objects: []
                        },
                        treasures
                    }
                }
            });
            if (cardId) {
                next = this.addCardToDiscard(next, cardId);
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} perd le trésor ${cardId}.`);
            }
        }
        return next;
    }
    removeRandomDomainCard(state, playerId) {
        const meta = this.getMeta(state);
        const domain = (meta.domains ?? {})[playerId];
        const treasures = Array.isArray(domain?.treasures) ? [
            ...domain.treasures
        ] : [];
        const objects = Array.isArray(domain?.objects) ? [
            ...domain.objects
        ] : [];
        if (!treasures.length && !objects.length) {
            return this.discardRandomFromHand(state, playerId, 1);
        }
        const pool = [
            ...treasures,
            ...objects
        ];
        const { index, meta: updatedRng } = this.random.pickIndex(meta.rng ?? {}, pool.length);
        const cardId = pool[index];
        const newTreasures = treasures.filter((c)=>c !== cardId);
        const newObjects = objects.filter((c)=>c !== cardId);
        const next = this.setMeta(state, {
            ...meta,
            rng: updatedRng,
            domains: {
                ...meta.domains ?? {},
                [playerId]: {
                    treasures: newTreasures,
                    objects: newObjects
                }
            }
        });
        if (cardId) {
            return this.addCardToDiscard(this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} perd ${cardId} face à une attaque.`), cardId);
        }
        return next;
    }
    trimHand(state, playerId) {
        let next = state;
        let meta = this.getMeta(next);
        const hand = Array.isArray(meta.hands?.[playerId]) ? [
            ...meta.hands[playerId]
        ] : [];
        while(hand.length > 5){
            const removed = hand.pop();
            if (!removed) break;
            next = this.addCardToDiscard(next, removed);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} réduit sa main et défausse ${removed}.`);
            meta = this.getMeta(next);
        }
        next = this.setMeta(next, {
            ...meta,
            hands: {
                ...meta.hands ?? {},
                [playerId]: hand
            }
        });
        return next;
    }
    addCardToHand(state, playerId, cardId) {
        const meta = this.getMeta(state);
        const hand = Array.isArray(meta.hands?.[playerId]) ? [
            ...meta.hands[playerId]
        ] : [];
        hand.push(cardId);
        return this.setMeta(state, {
            ...meta,
            hands: {
                ...meta.hands ?? {},
                [playerId]: hand
            }
        });
    }
    removeCardFromHand(metadata, playerId, cardId) {
        const hands = {
            ...metadata.hands ?? {}
        };
        const hand = Array.isArray(hands[playerId]) ? [
            ...hands[playerId]
        ] : [];
        const index = hand.indexOf(cardId);
        if (index >= 0) {
            hand.splice(index, 1);
        }
        hands[playerId] = hand;
        return {
            ...metadata,
            hands
        };
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
    finishGame(state) {
        const meta = this.getMeta(state);
        const winnerId = this.determineWinner(meta);
        const next = {
            ...state,
            status: 'finished',
            metadata: {
                ...meta,
                winnerId
            }
        };
        return this.core.appendLog(next, winnerId ? `${(0, _playernamehelper.resolvePlayerNameFromState)(next, winnerId)} devient le Nain suprême !` : "La mine s'effondre et personne ne l'emporte.");
    }
    determineWinner(meta) {
        let bestId = null;
        let bestScore = -Infinity;
        let tie = false;
        for (const [playerIdStr, domain] of Object.entries(meta.domains ?? {})){
            const playerId = Number(playerIdStr);
            const value = this.scoreDomain(domain);
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
    scoreDomain(domain) {
        if (!domain) return 0;
        let total = 0;
        for (const cardId of [
            ...domain.treasures ?? [],
            ...domain.objects ?? []
        ]){
            const definition = _lagrandeminecards.LA_GRANDE_MINE_CARD_BY_ID[cardId];
            total += definition?.points ?? 0;
        }
        return total;
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
    availableOpponents(state, playerId) {
        const players = Array.isArray(state.players) ? state.players : [];
        return players.filter((player)=>player?.id != null && player.id !== playerId).map((player)=>player.id);
    }
    constructor(core, turns, random, deckPolicies){
        this.core = core;
        this.turns = turns;
        this.random = random;
        this.deckPolicies = deckPolicies;
    }
};
LaGrandeMineDeBarbakActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], LaGrandeMineDeBarbakActionService);
