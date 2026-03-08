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
    get PimpMyRideActionPayload () {
        return PimpMyRideActionPayload;
    },
    get PimpMyRideActionService () {
        return PimpMyRideActionService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _pimpmyridecards = require("../model/pimp-my-ride-cards");
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
let PimpMyRideActionPayload = class PimpMyRideActionPayload {
};
const CATEGORY_LABELS = {
    carrosserie: 'la carrosserie',
    roues: 'les roues',
    moteur: 'le moteur',
    volant: 'le volant',
    sieges: 'les sièges',
    phares: 'les phares',
    accessoires: 'les accessoires'
};
let PimpMyRideActionService = class PimpMyRideActionService {
    applyActions(state, actions) {
        const next = (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                play_card: ()=>{
                    next = this.handlePlayCard(next, action);
                    return next;
                },
                discard_card: ()=>{
                    next = this.handleDiscardCard(next, action);
                    return next;
                },
                pass: ()=>{
                    next = this.handlePass(next);
                    return next;
                }
            }, ()=>next);
        });
        return next;
    }
    handlePass(state) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        let next = this.ensurePlayerDrawn(state, playerId);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} garde sa carte et passe son tour.`);
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    handlePlayCard(state, action) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        let next = this.ensurePlayerDrawn(state, playerId);
        const payload = action.payload ?? {};
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) return next;
        const definition = _pimpmyridecards.PIMP_MY_RIDE_CARD_BY_ID[cardId];
        if (!definition) return next;
        const meta = this.getMeta(next);
        if (!this.playerHasCard(meta, playerId, cardId)) return next;
        let updatedMeta = this.removeCardFromHand(meta, playerId, cardId);
        let progress = this.getProgress(updatedMeta, playerId);
        progress = {
            ...progress,
            stageIndex: progress.stageIndex + 1,
            carParts: [
                ...progress.carParts,
                cardId
            ]
        };
        updatedMeta = this.setProgress(updatedMeta, playerId, progress);
        next = this.setMeta(next, updatedMeta);
        const category = definition.category;
        const label = CATEGORY_LABELS[category] ?? category;
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pose ${definition.name} pour ${label}.`);
        if (progress.stageIndex >= _pimpmyridecards.PIMP_MY_RIDE_CATEGORY_ORDER.length) {
            next = this.completeCar(next, playerId);
            progress = this.getProgress(this.getMeta(next), playerId);
        }
        if ((this.getMeta(next).winnerId ?? null) != null) {
            return this.clearDrawn(next);
        }
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    handleDiscardCard(state, action) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        let next = this.ensurePlayerDrawn(state, playerId);
        const payload = action.payload ?? {};
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) return next;
        const meta = this.getMeta(next);
        if (!this.playerHasCard(meta, playerId, cardId)) return next;
        let updatedMeta = this.removeCardFromHand(meta, playerId, cardId);
        updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
        next = this.setMeta(next, updatedMeta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} jette ${this.getCardName(cardId)} à la défausse.`);
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    completeCar(state, playerId) {
        let next = state;
        const meta = this.getMeta(next);
        const progress = this.getProgress(meta, playerId);
        const carParts = [
            ...progress.carParts
        ];
        const carNameEntry = _pimpmyridecards.PIMP_MY_RIDE_CAR_NAMES[meta.carNameIndex % _pimpmyridecards.PIMP_MY_RIDE_CAR_NAMES.length];
        const completedCar = {
            name: carNameEntry.name,
            description: carNameEntry.description,
            parts: carParts
        };
        const updatedProgress = {
            ...progress,
            stageIndex: 0,
            carParts: [],
            completedCars: [
                ...progress.completedCars,
                completedCar
            ]
        };
        const nextMeta = {
            ...meta,
            progress: {
                ...meta.progress,
                [playerId]: updatedProgress
            },
            carNameIndex: (meta.carNameIndex + 1) % _pimpmyridecards.PIMP_MY_RIDE_CAR_NAMES.length
        };
        next = this.setMeta(next, nextMeta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} termine la voiture ${carNameEntry.name} (${carNameEntry.description}).`);
        if (updatedProgress.completedCars.length >= 3) {
            next = {
                ...next,
                status: 'finished',
                metadata: {
                    ...this.getMeta(next),
                    winnerId: playerId
                }
            };
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} remporte la partie en terminant trois voitures !`);
        }
        return next;
    }
    ensurePlayerDrawn(state, playerId) {
        const meta = this.getMeta(state);
        if (meta.drawnPlayerId === playerId) return state;
        const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
        let next = this.setMeta(state, {
            ...updatedMeta,
            drawnPlayerId: playerId,
            drawnCardId: cardId
        });
        if (cardId) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pioche ${this.getCardName(cardId)}.`);
            next = this.addCardToHand(next, playerId, cardId);
        } else {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} ne trouve plus de cartes à piocher.`);
        }
        return next;
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
    setProgress(meta, playerId, progress) {
        return {
            ...meta,
            progress: {
                ...meta.progress,
                [playerId]: progress
            }
        };
    }
    getProgress(meta, playerId) {
        return meta.progress?.[playerId] ?? {
            stageIndex: 0,
            carParts: [],
            completedCars: []
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
    playerHasCard(meta, playerId, cardId) {
        return Array.isArray(meta.hands?.[playerId]) && meta.hands[playerId].includes(cardId);
    }
    getCardName(cardId) {
        return _pimpmyridecards.PIMP_MY_RIDE_CARD_BY_ID[cardId]?.name ?? cardId;
    }
    clearDrawn(state) {
        const meta = this.getMeta(state);
        return this.setMeta(state, {
            ...meta,
            drawnPlayerId: null,
            drawnCardId: null
        });
    }
    constructor(core, turns, deckPolicies){
        this.core = core;
        this.turns = turns;
        this.deckPolicies = deckPolicies;
    }
};
PimpMyRideActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], PimpMyRideActionService);
