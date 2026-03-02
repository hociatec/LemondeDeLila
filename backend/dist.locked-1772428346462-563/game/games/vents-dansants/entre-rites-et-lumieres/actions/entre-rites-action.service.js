"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "EntreRitesActionService", {
    enumerable: true,
    get: function() {
        return EntreRitesActionService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _entreritescards = require("../model/entre-rites-cards");
const _entreritesstateentity = require("../model/entre-rites-state.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let EntreRitesActionService = class EntreRitesActionService {
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                ask_card: ()=>this.handleAskCard(next, action),
                pass: ()=>this.handlePass(next, action)
            }, ()=>next);
        });
    }
    handleAskCard(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const payload = action.payload ?? {};
        const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId || targetId == null || targetId === currentId) {
            return state;
        }
        const meta = this.getMeta(state);
        const targetHand = Array.isArray(meta.hands?.[targetId]) ? [
            ...meta.hands[targetId]
        ] : [];
        if (!targetHand.includes(cardId)) {
            let next = this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, currentId)} demande ${cardId} à ${(0, _playernamehelper.resolvePlayerNameFromState)(state, targetId)} sans succès et doit piocher.`);
            next = this.drawCardForPlayer(next, currentId);
            next = this.advanceTurn(next);
            return next;
        }
        let next = this.transferCard(state, targetId, currentId, cardId);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} récupère ${cardId} de ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)} et continue.`);
        next = this.checkVictory(next, currentId);
        return next;
    }
    handlePass(state, _action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const next = this.advanceTurn(state);
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} passe son tour.`);
    }
    advanceTurn(state) {
        let next = this.turns.advanceTurn(state);
        const meta = this.getMeta(next);
        const peace = Math.max((meta.peaceTurnsRemaining ?? 0) - 1, 0);
        let silence = meta.silenceUntilPlayerId ?? null;
        const nextPlayer = next.turn?.currentPlayerId ?? null;
        if (silence && nextPlayer === silence) {
            silence = null;
        }
        next = this.setMeta(next, {
            ...meta,
            peaceTurnsRemaining: peace,
            silenceUntilPlayerId: silence
        });
        return next;
    }
    transferCard(state, fromId, toId, cardId) {
        let meta = this.getMeta(state);
        meta = this.removeCardFromHand(meta, fromId, cardId);
        meta = this.addCardToHand(meta, toId, cardId);
        let next = this.setMeta(state, meta);
        next = this.rebuildCollections(next, fromId);
        next = this.rebuildCollections(next, toId);
        next = this.checkVictory(next, toId);
        return next;
    }
    drawCardForPlayer(state, playerId) {
        const { cardId, card, state: afterDraw } = this.drawSingleCard(state);
        if (!cardId || !card) {
            return this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} ne peut plus piocher, la pioche est vide.`);
        }
        return this.handleDrawnCard(afterDraw, playerId, card);
    }
    drawSingleCard(state) {
        const meta = this.getMeta(state);
        const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
        const next = this.setMeta(state, updatedMeta);
        const card = cardId ? _entreritescards.ENTRE_RITES_CARD_BY_ID[cardId] : undefined;
        return {
            state: next,
            cardId,
            card
        };
    }
    handleDrawnCard(state, playerId, card, allowSpecial = true) {
        if (card.type === 'family') {
            let next = this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} pioche ${card.name}.`);
            const meta = this.addCardToHand(this.getMeta(next), playerId, card.id);
            next = this.setMeta(next, meta);
            next = this.rebuildCollections(next, playerId);
            return this.checkVictory(next, playerId);
        }
        if (!allowSpecial) {
            return state;
        }
        return this.handleSpecialEffect(state, playerId, card);
    }
    handleSpecialEffect(state, playerId, card) {
        let next = state;
        if (this.isSilenced(next, playerId)) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pioche ${card.name} mais ses pouvoirs sont désormais muets.`);
            next = this.discardCard(next, playerId, card.id);
            next = this.recordSpecial(next, playerId, card.id);
            return next;
        }
        switch(card.effect){
            case 'draw_two_choose_one':
                next = this.effectDrawTwo(next, playerId);
                break;
            case 'draw_and_trigger':
                next = this.effectDrawAndTrigger(next, playerId);
                break;
            case 'collect_from_others':
                next = this.effectCollectFromOthers(next, playerId);
                break;
            case 'take_from_discard':
                next = this.effectTakeFromDiscard(next, playerId);
                break;
            case 'mute_specials':
                next = this.effectMuteSpecials(next, playerId);
                break;
            case 'swap_hands':
                next = this.effectSwapHands(next, playerId);
                break;
            case 'free_family':
                next = this.effectFreeFamily(next, playerId);
                break;
            case 'reshuffle_cycle':
                next = this.effectReshuffleCycle(next, playerId);
                break;
            case 'peace_turns':
                next = this.effectPeaceTurns(next);
                break;
            case 'reveal_and_steal':
                next = this.effectRevealAndSteal(next, playerId);
                break;
            default:
                next = this.discardCard(next, playerId, card.id);
        }
        next = this.recordSpecial(next, playerId, card.id);
        return this.checkVictory(next, playerId);
    }
    effectDrawTwo(state, playerId) {
        let next = state;
        for(let i = 0; i < 2; i += 1){
            const { card, state: drawn } = this.drawSingleCard(next);
            if (!card) break;
            next = this.handleDrawnCard(drawn, playerId, card);
        }
        return next;
    }
    effectDrawAndTrigger(state, playerId) {
        const { card, state: drawn } = this.drawSingleCard(state);
        if (!card) return state;
        return this.handleDrawnCard(drawn, playerId, card);
    }
    effectCollectFromOthers(state, playerId) {
        let next = this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} invoque la Bénédiction et réclame une carte à chaque adversaire.`);
        const players = (Array.isArray(next.players) ? next.players : []).filter((p)=>p?.id != null && p.id !== playerId);
        for (const player of players){
            const opponentId = player.id;
            const meta = this.getMeta(next);
            const hand = Array.isArray(meta.hands?.[opponentId]) ? [
                ...meta.hands[opponentId]
            ] : [];
            if (!hand.length) {
                continue;
            }
            const cardId = hand.shift();
            let updatedMeta = this.removeCardFromHand(meta, opponentId, cardId);
            updatedMeta = this.addCardToHand(updatedMeta, playerId, cardId);
            next = this.setMeta(next, updatedMeta);
            next = this.rebuildCollections(next, opponentId);
            next = this.rebuildCollections(next, playerId);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} prend ${cardId} à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, opponentId)}.`);
        }
        return next;
    }
    effectTakeFromDiscard(state, playerId) {
        const meta = this.getMeta(state);
        const discard = [
            ...meta.discard ?? []
        ];
        if (!discard.length) {
            return this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} cherche dans la défausse mais rien n’y est.`);
        }
        const cardId = discard.pop();
        const card = _entreritescards.ENTRE_RITES_CARD_BY_ID[cardId];
        const stateAfterDiscard = this.setMeta(state, {
            ...meta,
            discard
        });
        if (!card) {
            return stateAfterDiscard;
        }
        const next = this.handleDrawnCard(stateAfterDiscard, playerId, card);
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} reprend ${cardId} depuis la défausse.`);
    }
    effectMuteSpecials(state, playerId) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            silenceUntilPlayerId: playerId
        };
        return this.core.appendLog(this.setMeta(state, nextMeta), `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} impose le Silence Sacré.`);
    }
    effectSwapHands(state, playerId) {
        const meta = this.getMeta(state);
        const opponents = (Array.isArray(state.players) ? state.players : []).filter((player)=>player?.id != null && player.id !== playerId);
        const target = opponents.find((player)=>(meta.hands?.[player.id ?? 0]?.length ?? 0) > 0);
        if (!target || target.id == null) {
            return this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} invoque l’Envol Mystique sans adversaire disponible.`);
        }
        const targetId = target.id;
        const playerHand = [
            ...meta.hands?.[playerId] ?? []
        ];
        const targetHand = [
            ...meta.hands?.[targetId] ?? []
        ];
        const nextMeta = {
            ...meta,
            hands: {
                ...meta.hands ?? {},
                [playerId]: targetHand,
                [targetId]: playerHand
            }
        };
        let next = this.setMeta(state, nextMeta);
        next = this.rebuildCollections(next, playerId);
        next = this.rebuildCollections(next, targetId);
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} échange sa main avec ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)}.`);
    }
    effectFreeFamily(state, playerId) {
        const metadata = this.getMeta(state);
        const completed = new Set(metadata.completedFamilies?.[playerId] ?? []);
        const familyKeys = Object.keys(_entreritescards.ENTRE_RITES_CUSTOM_FAMILY_SIZE);
        const pending = familyKeys.find((familyId)=>!completed.has(familyId));
        if (!pending) {
            return this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} active la Clé du Jardin Caché mais toutes les familles sont déjà complètes.`);
        }
        completed.add(pending);
        const nextMeta = {
            ...metadata,
            completedFamilies: {
                ...metadata.completedFamilies ?? {},
                [playerId]: Array.from(completed)
            }
        };
        const next = this.setMeta(state, nextMeta);
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pose une famille secrète grâce à la Clé du Jardin Caché.`);
    }
    effectReshuffleCycle(state, playerId) {
        let next = this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} déclenche L’Aube Nouvelle : tout le monde défausse puis pioche.`);
        const players = (Array.isArray(next.players) ? next.players : []).filter((p)=>p?.id != null);
        for (const player of players){
            const targetId = player.id;
            next = this.discardOneCard(next, targetId);
        }
        for (const player of players){
            next = this.drawCardForPlayer(next, player.id);
        }
        return next;
    }
    effectPeaceTurns(state) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            peaceTurnsRemaining: 2
        };
        return this.core.appendLog(this.setMeta(state, nextMeta), `Une paix s’installe grâce à L’Étoile de l’Orient : aucune demande n’est possible pendant deux tours.`);
    }
    effectRevealAndSteal(state, playerId) {
        let next = state;
        const players = (Array.isArray(state.players) ? state.players : []).filter((player)=>player?.id != null && player.id !== playerId);
        const meta = this.getMeta(state);
        for (const player of players){
            const hand = meta.hands?.[player.id ?? 0] ?? [];
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, player.id)} révèle sa main : ${hand.join(', ') || 'vide'}.`);
        }
        const theftTarget = players.find((player)=>(meta.hands?.[player.id ?? 0]?.length ?? 0) > 0);
        if (!theftTarget || theftTarget.id == null) {
            return next;
        }
        const targetId = theftTarget.id;
        const targetHand = [
            ...meta.hands?.[targetId] ?? []
        ];
        const cardId = targetHand.shift();
        if (!cardId) return next;
        let updatedMeta = this.removeCardFromHand(this.getMeta(next), targetId, cardId);
        updatedMeta = this.addCardToHand(updatedMeta, playerId, cardId);
        next = this.setMeta(next, updatedMeta);
        next = this.rebuildCollections(next, targetId);
        next = this.rebuildCollections(next, playerId);
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} s’empare de ${cardId} grâce au Chant du Coq.`);
    }
    discardOneCard(state, playerId) {
        const meta = this.getMeta(state);
        const hand = Array.isArray(meta.hands?.[playerId]) ? [
            ...meta.hands[playerId]
        ] : [];
        if (!hand.length) {
            return state;
        }
        const cardId = hand.shift();
        let updatedMeta = this.removeCardFromHand(meta, playerId, cardId);
        updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
        const next = this.setMeta(state, updatedMeta);
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} défausse ${cardId}.`);
    }
    discardCard(state, playerId, cardId) {
        const meta = this.getMeta(state);
        const updatedMeta = this.addCardToDiscard(this.removeCardFromHand(meta, playerId, cardId), cardId);
        const next = this.setMeta(state, updatedMeta);
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} défausse ${cardId}.`);
    }
    isSilenced(state, playerId) {
        const meta = this.getMeta(state);
        const silence = meta.silenceUntilPlayerId ?? null;
        return silence != null && silence !== playerId;
    }
    rebuildCollections(state, playerId) {
        const meta = this.getMeta(state);
        const hand = Array.isArray(meta.hands?.[playerId]) ? [
            ...meta.hands[playerId]
        ] : [];
        const group = {};
        hand.forEach((cardId)=>{
            const card = _entreritescards.ENTRE_RITES_CARD_BY_ID[cardId];
            if (card?.type === 'family') {
                const bucket = [
                    ...group[card.familyId] ?? []
                ];
                bucket.push(cardId);
                group[card.familyId] = bucket;
            }
        });
        const completed = new Set(meta.completedFamilies?.[playerId] ?? []);
        for (const [familyId, values] of Object.entries(group)){
            const needed = _entreritescards.ENTRE_RITES_CUSTOM_FAMILY_SIZE[familyId] ?? 7;
            if (needed > 0 && values.length >= needed) {
                if (!completed.has(familyId)) {
                    completed.add(familyId);
                    values.forEach((id)=>{
                        const index = hand.indexOf(id);
                        if (index >= 0) hand.splice(index, 1);
                    });
                    group[familyId] = [];
                }
            }
        }
        const families = {
            ...meta.familyCollections ?? {}
        };
        families[playerId] = group;
        const completedFamilies = {
            ...meta.completedFamilies ?? {}
        };
        completedFamilies[playerId] = Array.from(completed);
        const hands = {
            ...meta.hands ?? {}
        };
        hands[playerId] = hand;
        return this.setMeta(state, {
            ...meta,
            familyCollections: families,
            completedFamilies,
            hands
        });
    }
    checkVictory(state, playerId) {
        if (state.status === 'finished') return state;
        const meta = this.getMeta(state);
        const totalFamilies = Object.values(meta.completedFamilies ?? {}).reduce((sum, list)=>sum + (Array.isArray(list) ? list.length : 0), 0);
        if (totalFamilies >= _entreritesstateentity.ENTRE_RITES_TOTAL_FAMILIES) {
            const winnerId = this.findWinner(meta) ?? playerId;
            const next = this.core.appendLog(state, `Toutes les familles sont complétées. ${(0, _playernamehelper.resolvePlayerNameFromState)(state, winnerId)} remporte la partie !`);
            const metaAfter = this.getMeta(next);
            return {
                ...next,
                status: 'finished',
                metadata: {
                    ...metaAfter,
                    winnerId
                }
            };
        }
        return state;
    }
    findWinner(meta) {
        const candidates = Object.keys(meta.completedFamilies ?? []).map((id)=>Number(id));
        let bestId = null;
        let bestFamilies = -1;
        let bestSpecials = -1;
        for (const playerId of candidates){
            const families = meta.completedFamilies?.[playerId]?.length ?? 0;
            const specials = meta.specialsPlayedCount?.[playerId] ?? 0;
            if (families > bestFamilies || families === bestFamilies && specials > bestSpecials) {
                bestId = playerId;
                bestFamilies = families;
                bestSpecials = specials;
            }
        }
        return bestId;
    }
    recordSpecial(state, playerId, cardId) {
        const meta = this.getMeta(state);
        const specials = {
            ...meta.specialsPlayed ?? {}
        };
        const count = {
            ...meta.specialsPlayedCount ?? {}
        };
        specials[playerId] = [
            ...specials[playerId] ?? [],
            cardId
        ];
        count[playerId] = (count[playerId] ?? 0) + 1;
        return this.setMeta(state, {
            ...meta,
            specialsPlayed: specials,
            specialsPlayedCount: count
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
    addCardToHand(meta, playerId, cardId) {
        const hands = {
            ...meta.hands ?? {}
        };
        const hand = [
            ...hands[playerId] ?? [],
            cardId
        ];
        hands[playerId] = hand;
        return {
            ...meta,
            hands
        };
    }
    removeCardFromHand(meta, playerId, cardId) {
        const hands = {
            ...meta.hands ?? {}
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
    setMeta(state, metadata) {
        return {
            ...state,
            metadata
        };
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    constructor(core, turns, deckPolicies){
        this.core = core;
        this.turns = turns;
        this.deckPolicies = deckPolicies;
    }
};
EntreRitesActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], EntreRitesActionService);
