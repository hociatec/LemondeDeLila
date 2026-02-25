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
exports.PiratesEnVadrouillePresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const pirates_en_vadrouille_definition_1 = require("../definitions/pirates-en-vadrouille.definition");
const Rulebook = __importStar(require("../rulebook/rulebook"));
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
let PiratesEnVadrouillePresenterService = class PiratesEnVadrouillePresenterService {
    boardPayload;
    constructor(boardPayload) {
        this.boardPayload = boardPayload;
    }
    exposeStateForUser(state, userId) {
        const actions = Rulebook.getAvailableActions(state, userId);
        const meta = this.getMeta(state);
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p) => p?.id === userId);
        const scoreLines = players.map((p) => {
            const name = typeof p?.username === 'string' && p.username.trim().length > 0
                ? p.username.trim()
                : `Joueur ${p?.id ?? '?'}`;
            const collection = meta.collections?.[p?.id ?? -1] ?? null;
            const treasures = Array.isArray(collection?.treasures)
                ? collection.treasures.length
                : 0;
            return `${name} : ${treasures} trésor${treasures > 1 ? 's' : ''}`;
        });
        return {
            ...state,
            catalog: {
                phases: pirates_en_vadrouille_definition_1.PIRATES_GAME.phaseOrder.map((p) => p.id),
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
                        collection: {
                            title: 'Cartes & pièces',
                            message: this.buildCollectionMessage(meta.collections?.[userId] ?? null),
                        },
                        score: {
                            title: 'Trésors',
                            message: scoreLines.length
                                ? scoreLines.join('\n')
                                : 'Trésors: indisponible.',
                        },
                    },
                },
            },
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions),
        };
    }
    buildCollectionMessage(collection) {
        if (!collection)
            return 'Cartes : (aucune) | Pièces : 0';
        const cards = [
            `Trésors : ${collection.treasures.length}`,
            `Bonus : ${collection.bonus.length}`,
            `Obstacles : ${collection.obstacles.length}`,
        ];
        return `${cards.join(' | ')} | Pièces : ${collection.goldPieces}`;
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
};
exports.PiratesEnVadrouillePresenterService = PiratesEnVadrouillePresenterService;
exports.PiratesEnVadrouillePresenterService = PiratesEnVadrouillePresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [board_payload_service_1.BoardPayloadService])
], PiratesEnVadrouillePresenterService);
//# sourceMappingURL=pirates-en-vadrouille-presenter.service.js.map