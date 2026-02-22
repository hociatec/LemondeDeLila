"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxiExpressPresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const taxi_express_definition_1 = require("../definitions/taxi-express.definition");
const TRIPS_TO_WIN = 5;
let TaxiExpressPresenterService = class TaxiExpressPresenterService {
    boardPayload;
    constructor(boardPayload) {
        this.boardPayload = boardPayload;
    }
    exposeStateForUser(state, userId) {
        const actions = Rulebook.getAvailableActions(state, userId);
        const meta = this.getMeta(state);
        const client = this.getActiveClient(meta, userId);
        const event = this.getActiveEvent(meta);
        const completed = meta.completedTrips?.[userId] ?? 0;
        const players = Array.isArray(state.players) ? state.players : [];
        const scoreLines = players.map((p) => {
            const name = typeof p?.username === 'string' && p.username.trim().length > 0
                ? p.username.trim()
                : `Joueur ${p?.id ?? '?'}`;
            const count = meta.completedTrips?.[p?.id ?? -1] ?? 0;
            return `${name} : ${count} trajet${count > 1 ? 's' : ''}`;
        });
        const stateRecord = asRecord(state);
        const baseExtras = asRecord(stateRecord.extras);
        return {
            ...state,
            catalog: {
                phases: taxi_express_definition_1.TAXI_EXPRESS_GAME.phaseOrder.map((phase) => phase.id),
                victory: meta.winnerId != null
                    ? {
                        winnerId: meta.winnerId,
                    }
                    : null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions, () => 'Lancer le dé'),
            pending: state.pending ?? null,
            extras: {
                ...baseExtras,
                taxi: {
                    currentClient: client
                        ? `${client.clientName} vers ${this.tileTitle(meta, client.destinationId)}`
                        : 'Aucun client à bord.',
                    route: client?.route ?? 'Aucun trajet en cours.',
                    stats: `Trajets complétés : ${completed} / ${TRIPS_TO_WIN}`,
                    event: event
                        ? `${event.title} bloque ${this.tileTitle(meta, event.blockedTileId)}.`
                        : 'Pas d’obstacle identifié.',
                },
                ui: {
                    panels: {
                        position: {
                            title: 'Position',
                            message: this.boardPayload.buildPositionPanelMessage({
                                tilesRaw: meta.tiles,
                                positionsRaw: meta.positions,
                                playerId: userId,
                            }),
                        },
                        score: {
                            title: 'Trajets',
                            message: scoreLines.length
                                ? scoreLines.join('\n')
                                : 'Trajets: indisponible.',
                        },
                    },
                },
            },
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
        };
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    getActiveClient(meta, playerId) {
        const id = meta.activeClients?.[playerId] ?? null;
        if (id == null)
            return null;
        return meta.clients.find((client) => client.id === id) ?? null;
    }
    getActiveEvent(meta) {
        if (meta.lastEventId == null)
            return null;
        return meta.events.find((event) => event.id === meta.lastEventId) ?? null;
    }
    tileTitle(meta, tileId) {
        if (tileId == null)
            return 'case inconnue';
        const index = (meta.tiles ?? []).findIndex((tile) => tile.id === tileId);
        const tile = index >= 0 ? meta.tiles[index] : null;
        return tile?.title ?? `case ${tileId}`;
    }
};
exports.TaxiExpressPresenterService = TaxiExpressPresenterService;
exports.TaxiExpressPresenterService = TaxiExpressPresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [board_payload_service_1.BoardPayloadService])
], TaxiExpressPresenterService);
function asRecord(value) {
    if (value == null || typeof value !== 'object')
        return {};
    return value;
}
//# sourceMappingURL=taxi-express-presenter.service.js.map