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
exports.MonVillagePresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const mon_village_definition_1 = require("../definitions/mon-village.definition");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const ZONE_LABELS = {
    1: 'Terre & Nature',
    2: 'Artisanat',
    3: 'Textile & Habillement',
    4: 'Bouche',
    5: 'Quotidien & Services',
    6: 'Savoir & Culture',
    7: 'Protection & Société',
    8: 'Très anciens & universels',
};
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
let MonVillagePresenterService = class MonVillagePresenterService {
    boardPayload;
    constructor(boardPayload) {
        this.boardPayload = boardPayload;
    }
    exposeStateForUser(state, userId) {
        const actions = Rulebook.getAvailableActions(state, userId);
        const meta = (state.metadata ?? {});
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p) => p?.id === userId);
        const collection = meta.collections?.[userId] ?? null;
        const availableMessage = this.buildAvailableMessage((meta.decks ?? {}));
        const scoreMessage = this.buildScoresMessage(players, meta.collections ?? {});
        return {
            ...state,
            catalog: {
                phases: mon_village_definition_1.MON_VILLAGE_GAME.phaseOrder.map((p) => p.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions, (action) => action.type === 'roll' ? 'Lancer le dé' : action.type),
            pending: state.pending ?? null,
            extras: {
                ...asRecord(state.extras),
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
                        cartes: {
                            title: 'Cartes',
                            message: this.buildCollectionMessage(collection),
                        },
                        available: {
                            title: 'Disponibles',
                            message: availableMessage,
                        },
                        score: {
                            title: 'Scores',
                            message: scoreMessage,
                        },
                    },
                },
            },
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
        };
    }
    buildCollectionMessage(collection) {
        if (!collection) {
            return 'Cartes totales : 0';
        }
        const lines = [`Cartes totales : ${collection.total}`];
        const zoneEntries = Object.entries(collection.byZone ?? {})
            .map(([zoneId, count]) => ({
            zoneId: Number(zoneId),
            label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
            count,
        }))
            .sort((a, b) => a.zoneId - b.zoneId)
            .map((entry) => `${entry.label} (${entry.count})`);
        if (zoneEntries.length) {
            lines.push(zoneEntries.join(' | '));
        }
        return lines.join('\n');
    }
    buildAvailableMessage(decks) {
        const entries = Object.entries(decks ?? {})
            .map(([zoneId, cards]) => ({
            zoneId: Number(zoneId),
            label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
            count: Array.isArray(cards) ? cards.length : 0,
        }))
            .sort((a, b) => a.zoneId - b.zoneId);
        if (!entries.length) {
            return 'Aucune carte disponible.';
        }
        return entries
            .map((entry) => `${entry.label} (${entry.count})`)
            .join(' | ');
    }
    buildScoresMessage(players, collections) {
        if (!players.length)
            return 'Scores: indisponibles.';
        const lines = players.map((p) => {
            const name = typeof p?.username === 'string' && p.username.trim().length > 0
                ? p.username.trim()
                : `Joueur ${p?.id ?? '?'}`;
            const collection = collections?.[p?.id ?? -1] ?? null;
            if (!collection)
                return `${name} : 0`;
            const zoneEntries = Object.entries(collection.byZone ?? {})
                .map(([zoneId, count]) => ({
                zoneId: Number(zoneId),
                label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
                count,
            }))
                .sort((a, b) => a.zoneId - b.zoneId)
                .map((entry) => `${entry.label} (${entry.count})`);
            const total = collection.total ?? 0;
            return zoneEntries.length
                ? `${name} : ${total} | ${zoneEntries.join(' | ')}`
                : `${name} : ${total}`;
        });
        return lines.join('\n');
    }
};
exports.MonVillagePresenterService = MonVillagePresenterService;
exports.MonVillagePresenterService = MonVillagePresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [board_payload_service_1.BoardPayloadService])
], MonVillagePresenterService);
//# sourceMappingURL=mon-village-presenter.service.js.map