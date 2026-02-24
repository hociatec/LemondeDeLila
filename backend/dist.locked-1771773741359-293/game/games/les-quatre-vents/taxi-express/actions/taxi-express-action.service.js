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
var TaxiExpressActionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxiExpressActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const deck_policies_service_1 = require("../../../../modules/deck-policies/services/deck-policies.service");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
let TaxiExpressActionService = class TaxiExpressActionService {
    static { TaxiExpressActionService_1 = this; }
    core;
    random;
    turns;
    deckPolicies;
    static TRIPS_TO_WIN = 5;
    constructor(core, random, turns, deckPolicies) {
        this.core = core;
        this.random = random;
        this.turns = turns;
        this.deckPolicies = deckPolicies;
    }
    applyActions(state, actions) {
        const next = (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeLowerActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                roll: () => {
                    next = this.handleRoll(next);
                    return next;
                },
                'roll dice': () => {
                    next = this.handleRoll(next);
                    return next;
                },
            }, () => next);
        });
        return next;
    }
    handleRoll(state) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started')
            return state;
        if (state.pending)
            return state;
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null)
            return state;
        let next = this.ensureActiveClient(state, playerId);
        next = this.ensureEventForPlayer(next, playerId);
        let meta = this.getMeta(next);
        const clientId = meta.activeClients?.[playerId] ?? null;
        const client = clientId != null ? this.findClient(meta, clientId) : null;
        if (!client)
            return next;
        const rollResult = this.random.rollDice(meta, 6);
        const afterRollMeta = {
            ...meta,
            ...rollResult.meta,
        };
        next = {
            ...next,
            lastRoll: rollResult.roll,
            metadata: { ...(next.metadata ?? {}), ...afterRollMeta },
        };
        const startIndex = meta.positions?.[playerId] ?? 0;
        meta = afterRollMeta;
        const finalIndex = Math.min(Math.max(0, (meta.tiles?.length ?? 1) - 1), startIndex + rollResult.roll);
        next = this.setPlayerPosition(next, playerId, finalIndex);
        const arrivedTile = this.getTileByIndex(this.getMeta(next), finalIndex);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} avance de ${rollResult.roll} case(s) et place son taxi en case ${finalIndex + 1} (${arrivedTile?.title ?? `case ${finalIndex + 1}`}).`);
        meta = this.getMeta(next);
        const pathIndices = this.buildPathIndices(startIndex + 1, finalIndex);
        const blockedIndex = this.findTileIndexById(meta, meta.blockedTileId);
        if (blockedIndex != null && pathIndices.includes(blockedIndex)) {
            const blockedTile = this.getTileByIndex(meta, blockedIndex);
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} croise l’événement ${blockedTile?.title ?? `case ${meta.blockedTileId}`}, le client descend et le taxi retourne à la station.`);
            next = this.setPlayerPosition(next, playerId, 0);
            next = this.dropActiveClient(next, playerId);
            return this.turns.advanceTurn(next);
        }
        const destinationIndex = this.findTileIndexById(meta, client.destinationId);
        if (destinationIndex === finalIndex) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} dépose ${client.clientName} à destination (${arrivedTile?.title ?? ''}).`);
            next = this.incrementTrip(next, playerId);
            const completed = this.getMeta(next).completedTrips?.[playerId] ?? 0;
            if (completed >= TaxiExpressActionService_1.TRIPS_TO_WIN) {
                next = this.setWinner(next, playerId, completed);
                return { ...next, status: 'finished' };
            }
            next = this.dropActiveClient(next, playerId);
            next = this.ensureActiveClient(next, playerId);
            return this.turns.advanceTurn(next);
        }
        return this.turns.advanceTurn(next);
    }
    ensureActiveClient(state, playerId) {
        const meta = this.getMeta(state);
        const existing = meta.activeClients?.[playerId];
        if (existing != null)
            return state;
        const draw = this.drawClientCard(meta);
        const updatedMeta = {
            ...draw.meta,
            activeClients: {
                ...meta.activeClients,
                [playerId]: draw.cardId,
            },
        };
        let next = this.replaceMeta(state, updatedMeta);
        if (draw.cardId != null) {
            const card = this.findClient(updatedMeta, draw.cardId);
            if (card) {
                next = this.core.appendLog(next, `Nouveau client : ${card.clientName} vers ${this.tileTitleById(updatedMeta, card.destinationId)}.`);
            }
        }
        else {
            next = this.core.appendLog(next, 'Aucun client disponible pour le moment.');
        }
        return next;
    }
    ensureEventForPlayer(state, playerId) {
        const meta = this.getMeta(state);
        if (meta.eventTurnPlayerId === playerId && meta.lastEventId != null) {
            return state;
        }
        const draw = this.drawEventCard(meta);
        const nextMeta = {
            ...draw.meta,
            eventTurnPlayerId: playerId,
            blockedTileId: draw.card?.blockedTileId ?? null,
            lastEventId: draw.card?.id ?? null,
        };
        let next = this.replaceMeta(state, nextMeta);
        if (draw.card) {
            const tile = this.tileTitleById(nextMeta, draw.card.blockedTileId);
            next = this.core.appendLog(next, `Événement : ${draw.card.title} (${tile}) – ${draw.card.description}`);
        }
        else {
            next = this.core.appendLog(next, 'Événement : la ville est calme, aucun obstacle identifié.');
        }
        return next;
    }
    incrementTrip(state, playerId) {
        const meta = this.getMeta(state);
        const current = meta.completedTrips?.[playerId] ?? 0;
        const updated = {
            ...meta,
            completedTrips: {
                ...(meta.completedTrips ?? {}),
                [playerId]: current + 1,
            },
        };
        return this.replaceMeta(state, updated);
    }
    setWinner(state, playerId, completed) {
        const meta = this.getMeta(state);
        const updatedMeta = {
            ...meta,
            winnerId: playerId,
        };
        let next = {
            ...state,
            status: 'finished',
            metadata: { ...(state.metadata ?? {}), ...updatedMeta },
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} remporte la course avec ${completed} trajets validés !`);
        return next;
    }
    dropActiveClient(state, playerId) {
        const meta = this.getMeta(state);
        const updatedMeta = {
            ...meta,
            activeClients: {
                ...(meta.activeClients ?? {}),
                [playerId]: null,
            },
        };
        return this.replaceMeta(state, updatedMeta);
    }
    drawClientCard(meta) {
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(meta.deckClients) ? meta.deckClients : [],
            discard: Array.isArray(meta.discardClients) ? meta.discardClients : [],
            useWholeMetaRng: true,
            discardDrawnCard: true,
        });
        return {
            cardId: draw.card,
            meta: {
                ...draw.meta,
                deckClients: draw.pile,
                discardClients: draw.discard,
            },
        };
    }
    drawEventCard(meta) {
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(meta.deckEvents) ? meta.deckEvents : [],
            discard: Array.isArray(meta.discardEvents) ? meta.discardEvents : [],
            useWholeMetaRng: true,
            discardDrawnCard: true,
        });
        const nextMeta = {
            ...draw.meta,
            deckEvents: draw.pile,
            discardEvents: draw.discard,
        };
        const card = draw.card == null ? null : this.findEvent(nextMeta, draw.card);
        return { card, meta: nextMeta };
    }
    buildPathIndices(start, end) {
        if (end < start)
            return [];
        const out = [];
        for (let idx = start; idx <= end; idx++) {
            out.push(idx);
        }
        return out;
    }
    setPlayerPosition(state, playerId, index) {
        const meta = this.getMeta(state);
        const updatedMeta = {
            ...meta,
            positions: {
                ...(meta.positions ?? {}),
                [playerId]: index,
            },
        };
        return this.replaceMeta(state, updatedMeta);
    }
    replaceMeta(state, meta) {
        return {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta },
        };
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    findClient(meta, cardId) {
        if (!cardId)
            return null;
        return (meta.clients ?? []).find((c) => c.id === cardId) ?? null;
    }
    findEvent(meta, cardId) {
        return (meta.events ?? []).find((event) => event.id === cardId) ?? null;
    }
    findTileIndexById(meta, tileId) {
        if (tileId == null)
            return null;
        const index = (meta.tiles ?? []).findIndex((tile) => tile.id === tileId);
        return index >= 0 ? index : null;
    }
    getTileByIndex(meta, index) {
        const tiles = meta.tiles ?? [];
        if (index < 0 || index >= tiles.length)
            return null;
        return tiles[index];
    }
    tileTitleById(meta, tileId) {
        const index = this.findTileIndexById(meta, tileId);
        const tile = index != null ? this.getTileByIndex(meta, index) : null;
        return tile?.title ?? `case ${tileId ?? '?'}`;
    }
};
exports.TaxiExpressActionService = TaxiExpressActionService;
exports.TaxiExpressActionService = TaxiExpressActionService = TaxiExpressActionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        deck_policies_service_1.DeckPoliciesService])
], TaxiExpressActionService);
//# sourceMappingURL=taxi-express-action.service.js.map