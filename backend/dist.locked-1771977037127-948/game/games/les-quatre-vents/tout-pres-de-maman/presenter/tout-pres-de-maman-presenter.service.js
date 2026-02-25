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
exports.ToutPresDeMamanPresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const Rulebook = __importStar(require("../rulebook/rulebook"));
const tout_pres_de_maman_definition_1 = require("../definitions/tout-pres-de-maman.definition");
let ToutPresDeMamanPresenterService = class ToutPresDeMamanPresenterService {
    boardPayload;
    constructor(boardPayload) {
        this.boardPayload = boardPayload;
    }
    exposeStateForUser(state, userId) {
        const actions = Rulebook.getAvailableActions(state, userId);
        const meta = this.getMeta(state);
        const tokens = meta.tokens?.[userId] ?? 0;
        const totalNeeded = 3;
        const nextCard = this.peekNextCard(meta);
        const players = Array.isArray(state.players) ? state.players : [];
        const scoreLines = players.map((p) => {
            const name = typeof p?.username === 'string' && p.username.trim().length > 0
                ? p.username.trim()
                : `Joueur ${p?.id ?? '?'}`;
            const count = meta.tokens?.[p?.id ?? -1] ?? 0;
            return `${name} : ${count} eucalyptus`;
        });
        const stateRecord = asRecord(state);
        const baseExtras = asRecord(stateRecord.extras);
        return {
            ...state,
            catalog: {
                phases: tout_pres_de_maman_definition_1.TOUT_PRES_DE_MAMAN_GAME.phaseOrder.map((phase) => phase.id),
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
                tokens: `${tokens} / ${totalNeeded} jetons eucalyptus`,
                nextCard: nextCard?.text ?? 'Pile de cartes vide',
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
                            title: 'Eucalyptus',
                            message: scoreLines.length
                                ? scoreLines.join('\n')
                                : 'Eucalyptus: indisponible.',
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
    peekNextCard(meta) {
        const deck = Array.isArray(meta.deckCards) ? meta.deckCards : [];
        if (!deck.length)
            return null;
        const id = deck[0];
        return meta.cards.find((card) => card.id === id) ?? null;
    }
};
exports.ToutPresDeMamanPresenterService = ToutPresDeMamanPresenterService;
exports.ToutPresDeMamanPresenterService = ToutPresDeMamanPresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [board_payload_service_1.BoardPayloadService])
], ToutPresDeMamanPresenterService);
function asRecord(value) {
    if (value == null || typeof value !== 'object')
        return {};
    return value;
}
//# sourceMappingURL=tout-pres-de-maman-presenter.service.js.map