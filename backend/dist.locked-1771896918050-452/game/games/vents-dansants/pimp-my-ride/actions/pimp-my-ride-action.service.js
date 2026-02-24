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
exports.PimpMyRideActionService = exports.PimpMyRideActionPayload = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const deck_policies_service_1 = require("../../../../modules/deck-policies/services/deck-policies.service");
const pimp_my_ride_cards_1 = require("../model/pimp-my-ride-cards");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
class PimpMyRideActionPayload {
    cardId;
}
exports.PimpMyRideActionPayload = PimpMyRideActionPayload;
const CATEGORY_LABELS = {
    carrosserie: 'la carrosserie',
    roues: 'les roues',
    moteur: 'le moteur',
    volant: 'le volant',
    sieges: 'les si�ges',
    phares: 'les phares',
    accessoires: 'les accessoires',
};
let PimpMyRideActionService = class PimpMyRideActionService {
    core;
    turns;
    deckPolicies;
    constructor(core, turns, deckPolicies) {
        this.core = core;
        this.turns = turns;
        this.deckPolicies = deckPolicies;
    }
    applyActions(state, actions) {
        const next = (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                play_card: () => {
                    next = this.handlePlayCard(next, action);
                    return next;
                },
                discard_card: () => {
                    next = this.handleDiscardCard(next, action);
                    return next;
                },
                pass: () => {
                    next = this.handlePass(next);
                    return next;
                },
            }, () => next);
        });
        return next;
    }
    handlePass(state) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null)
            return state;
        let next = this.ensurePlayerDrawn(state, playerId);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} garde sa carte et passe son tour.`);
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    handlePlayCard(state, action) {
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null)
            return state;
        let next = this.ensurePlayerDrawn(state, playerId);
        const payload = (action.payload ?? {});
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId)
            return next;
        const definition = pimp_my_ride_cards_1.PIMP_MY_RIDE_CARD_BY_ID[cardId];
        if (!definition)
            return next;
        const meta = this.getMeta(next);
        if (!this.playerHasCard(meta, playerId, cardId))
            return next;
        let updatedMeta = this.removeCardFromHand(meta, playerId, cardId);
        let progress = this.getProgress(updatedMeta, playerId);
        progress = {
            ...progress,
            stageIndex: progress.stageIndex + 1,
            carParts: [...progress.carParts, cardId],
        };
        updatedMeta = this.setProgress(updatedMeta, playerId, progress);
        next = this.setMeta(next, updatedMeta);
        const category = definition.category;
        const label = CATEGORY_LABELS[category] ?? category;
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} pose ${definition.name} pour ${label}.`);
        if (progress.stageIndex >= pimp_my_ride_cards_1.PIMP_MY_RIDE_CATEGORY_ORDER.length) {
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
        if (playerId == null)
            return state;
        let next = this.ensurePlayerDrawn(state, playerId);
        const payload = (action.payload ?? {});
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId)
            return next;
        const meta = this.getMeta(next);
        if (!this.playerHasCard(meta, playerId, cardId))
            return next;
        let updatedMeta = this.removeCardFromHand(meta, playerId, cardId);
        updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
        next = this.setMeta(next, updatedMeta);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} jette ${this.getCardName(cardId)} � la d�fausse.`);
        next = this.turns.advanceTurn(next);
        return this.clearDrawn(next);
    }
    completeCar(state, playerId) {
        let next = state;
        const meta = this.getMeta(next);
        const progress = this.getProgress(meta, playerId);
        const carParts = [...progress.carParts];
        const carNameEntry = pimp_my_ride_cards_1.PIMP_MY_RIDE_CAR_NAMES[meta.carNameIndex % pimp_my_ride_cards_1.PIMP_MY_RIDE_CAR_NAMES.length];
        const completedCar = {
            name: carNameEntry.name,
            description: carNameEntry.description,
            parts: carParts,
        };
        const updatedProgress = {
            ...progress,
            stageIndex: 0,
            carParts: [],
            completedCars: [...progress.completedCars, completedCar],
        };
        const nextMeta = {
            ...meta,
            progress: {
                ...meta.progress,
                [playerId]: updatedProgress,
            },
            carNameIndex: (meta.carNameIndex + 1) % pimp_my_ride_cards_1.PIMP_MY_RIDE_CAR_NAMES.length,
        };
        next = this.setMeta(next, nextMeta);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} termine la voiture ${carNameEntry.name} (${carNameEntry.description}).`);
        if (updatedProgress.completedCars.length >= 3) {
            next = {
                ...next,
                status: 'finished',
                metadata: { ...this.getMeta(next), winnerId: playerId },
            };
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} remporte la partie en terminant trois voitures !`);
        }
        return next;
    }
    ensurePlayerDrawn(state, playerId) {
        const meta = this.getMeta(state);
        if (meta.drawnPlayerId === playerId)
            return state;
        const { cardId, meta: updatedMeta } = this.drawOneCard(meta);
        let next = this.setMeta(state, {
            ...updatedMeta,
            drawnPlayerId: playerId,
            drawnCardId: cardId,
        });
        if (cardId) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} pioche ${this.getCardName(cardId)}.`);
            next = this.addCardToHand(next, playerId, cardId);
        }
        else {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} ne trouve plus de cartes � piocher.`);
        }
        return next;
    }
    drawOneCard(meta) {
        const draw = this.deckPolicies.drawOne({
            meta,
            deckKey: 'deck',
            discardKey: 'discard',
            rngKey: 'rng',
        });
        return { cardId: draw.card, meta: draw.meta };
    }
    addCardToHand(state, playerId, cardId) {
        const meta = this.getMeta(state);
        const hands = { ...(meta.hands ?? {}) };
        const playerHand = [...(hands[playerId] ?? [])];
        playerHand.push(cardId);
        hands[playerId] = playerHand;
        return this.setMeta(state, { ...meta, hands });
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
    addCardToDiscard(meta, cardId) {
        const discard = [...(meta.discard ?? []), cardId];
        return { ...meta, discard };
    }
    setProgress(meta, playerId, progress) {
        return {
            ...meta,
            progress: { ...meta.progress, [playerId]: progress },
        };
    }
    getProgress(meta, playerId) {
        return (meta.progress?.[playerId] ?? {
            stageIndex: 0,
            carParts: [],
            completedCars: [],
        });
    }
    setMeta(state, metadata) {
        return { ...state, metadata };
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    playerHasCard(meta, playerId, cardId) {
        return (Array.isArray(meta.hands?.[playerId]) &&
            meta.hands[playerId].includes(cardId));
    }
    getCardName(cardId) {
        return pimp_my_ride_cards_1.PIMP_MY_RIDE_CARD_BY_ID[cardId]?.name ?? cardId;
    }
    clearDrawn(state) {
        const meta = this.getMeta(state);
        return this.setMeta(state, {
            ...meta,
            drawnPlayerId: null,
            drawnCardId: null,
        });
    }
};
exports.PimpMyRideActionService = PimpMyRideActionService;
exports.PimpMyRideActionService = PimpMyRideActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        turn_flow_service_1.TurnFlowService,
        deck_policies_service_1.DeckPoliciesService])
], PimpMyRideActionService);
//# sourceMappingURL=pimp-my-ride-action.service.js.map