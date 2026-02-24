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
exports.VoyagePresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const voyage_definition_1 = require("../definitions/voyage.definition");
const Rulebook = __importStar(require("../rulebook/rulebook"));
let VoyagePresenterService = class VoyagePresenterService {
    boardPayload;
    constructor(boardPayload) {
        this.boardPayload = boardPayload;
    }
    exposeStateForUser(state, userId) {
        const actions = Rulebook.getAvailableActions(state, userId);
        const meta = this.getMeta(state);
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p) => p?.id === userId);
        const c = meta.collections?.[userId] ?? {
            legend: 0,
            farce: 0,
            treasure: 0,
            landscape: 0,
        };
        const total = (c.legend ?? 0) + (c.farce ?? 0) + (c.treasure ?? 0) + (c.landscape ?? 0);
        const stateRecord = asRecord(state);
        const baseExtras = asRecord(stateRecord.extras);
        return {
            ...state,
            catalog: {
                phases: voyage_definition_1.VOYAGE_GAME.phaseOrder.map((p) => p.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions),
            pending: state.pending ?? null,
            extras: {
                ...baseExtras,
                currentPlayerView: {
                    id: userId,
                    username: me?.username ?? `Joueur ${userId}`,
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
                        cards: {
                            title: 'Cartes',
                            message: `Total ${total} (Légendes ${c.legend}, Trésors ${c.treasure}, Paysages ${c.landscape}).`,
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
};
exports.VoyagePresenterService = VoyagePresenterService;
exports.VoyagePresenterService = VoyagePresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [board_payload_service_1.BoardPayloadService])
], VoyagePresenterService);
function asRecord(value) {
    if (value == null || typeof value !== 'object')
        return {};
    return value;
}
//# sourceMappingURL=voyage-presenter.service.js.map