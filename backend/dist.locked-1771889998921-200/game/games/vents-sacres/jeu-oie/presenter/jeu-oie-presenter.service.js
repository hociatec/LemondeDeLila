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
exports.JeuOiePresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const JeuOieRulebook = __importStar(require("../rulebook/rulebook"));
const game_definition_1 = require("../definitions/game.definition");
let JeuOiePresenterService = class JeuOiePresenterService {
    boardPayload;
    constructor(boardPayload) {
        this.boardPayload = boardPayload;
    }
    exposeStateForUser(state, userId) {
        const actions = JeuOieRulebook.getAvailableActions(state, userId);
        const meta = (state.metadata ?? {});
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p) => p?.id === userId);
        const extras = {
            ...state.extras,
            currentPlayerView: {
                id: userId,
                username: me?.username ?? `Joueur ${userId}`,
            },
            ui: {
                panels: {
                    position: {
                        title: 'Position',
                        message: this.buildPositionMessage(meta, userId),
                    },
                    board: {
                        title: 'Plateau',
                        message: this.buildBoardMessage(meta),
                    },
                },
            },
        };
        return {
            ...state,
            catalog: {
                phases: game_definition_1.JEU_OIE_GAME.phaseOrder.map((p) => p.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions),
            pending: state.pending ?? null,
            extras,
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions, meta.laps),
        };
    }
    buildPositionMessage(meta, userId) {
        const tiles = Array.isArray(meta?.tiles) ? meta.tiles : [];
        const posRaw = meta?.positions?.[userId];
        const pos = typeof posRaw === 'number' ? posRaw : Number(posRaw);
        if (!Number.isFinite(pos) || tiles.length === 0) {
            return 'Position: inconnue.';
        }
        const startIndex = tiles.findIndex((t) => t?.type === 'start');
        const finishIndex = tiles.findIndex((t) => t?.type === 'finish');
        const effectiveStart = startIndex >= 0 ? startIndex : 0;
        const effectiveFinish = finishIndex >= 0 ? finishIndex : tiles.length - 1;
        const maxCase = effectiveFinish > 0 ? effectiveFinish : tiles.length - 1;
        if (maxCase <= 0) {
            return 'Position: inconnue.';
        }
        const lapRaw = meta?.laps?.[userId];
        const lap = typeof lapRaw === 'number' ? lapRaw : Number(lapRaw);
        const tourPlateau = Number.isFinite(lap) ? String(Math.trunc(lap)) : '?';
        const caseNumber = Math.max(0, Math.trunc(pos));
        if (caseNumber < effectiveStart) {
            return `Tour plateau ${tourPlateau}, avant départ (${caseNumber}/${maxCase}).`;
        }
        if (caseNumber === effectiveStart) {
            return `Tour plateau ${tourPlateau}, départ (${caseNumber}/${maxCase}).`;
        }
        if (caseNumber >= effectiveFinish) {
            return `Tour plateau ${tourPlateau}, arrivée (${maxCase}/${maxCase}).`;
        }
        return `Tour plateau ${tourPlateau}, case ${caseNumber}/${maxCase}.`;
    }
    buildBoardMessage(meta) {
        const tiles = Array.isArray(meta?.tiles) ? meta.tiles : [];
        if (tiles.length === 0) {
            return 'Plateau: indisponible.';
        }
        const startIndex = tiles.findIndex((t) => t?.type === 'start');
        const finishIndex = tiles.findIndex((t) => t?.type === 'finish');
        const from = startIndex >= 0 ? startIndex : 0;
        const to = finishIndex >= 0 ? finishIndex : tiles.length - 1;
        const lines = [];
        for (let i = from; i <= to; i += 1) {
            const t = tiles[i];
            const label = String(t?.label ?? '').trim() || `Case ${i}`;
            lines.push(`${i}: ${label}.`);
        }
        return lines.join('\n');
    }
};
exports.JeuOiePresenterService = JeuOiePresenterService;
exports.JeuOiePresenterService = JeuOiePresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [board_payload_service_1.BoardPayloadService])
], JeuOiePresenterService);
//# sourceMappingURL=jeu-oie-presenter.service.js.map