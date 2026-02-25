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
exports.FouleesFantastiquesPresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const board_payload_service_1 = require("../../../../modules/board/services/board-payload.service");
const FouleesFantastiquesRulebook = __importStar(require("../rulebook/rulebook"));
const game_definition_1 = require("../definitions/game.definition");
let FouleesFantastiquesPresenterService = class FouleesFantastiquesPresenterService {
    boardPayload;
    constructor(boardPayload) {
        this.boardPayload = boardPayload;
    }
    exposeStateForUser(state, userId) {
        const actions = FouleesFantastiquesRulebook.getAvailableActions(state, userId);
        const meta = (state.metadata ?? {});
        const arrivalProgress = (meta.trackLength ?? 0) + (meta.homeLength ?? 0) - 1;
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p) => p?.id === userId);
        const scoreLines = players.map((p) => {
            const name = typeof p?.username === 'string' && p.username.trim().length > 0
                ? p.username.trim()
                : `Joueur ${p?.id ?? '?'}`;
            const pid = p?.id ?? -1;
            const pawns = Array.isArray(meta.pawnsByPlayer?.[pid])
                ? meta.pawnsByPlayer[pid]
                : [];
            const arrived = pawns.filter((pawn) => (pawn?.progress ?? -1) >= arrivalProgress).length;
            return `${name} : ${arrived} arrivé${arrived > 1 ? 's' : ''}`;
        });
        const myPawns = Array.isArray(meta.pawnsByPlayer?.[userId])
            ? meta.pawnsByPlayer[userId]
            : [];
        const myColor = meta.colorsByPlayer?.[userId];
        const inStable = myPawns.filter((p) => (p?.progress ?? -1) < 0).length;
        const inHome = myPawns.filter((p) => typeof p?.progress === 'number' &&
            p.progress >= meta.trackLength &&
            p.progress < arrivalProgress).length;
        const finished = myPawns.filter((p) => (p?.progress ?? -1) >= arrivalProgress).length;
        const out = myPawns.filter((p) => typeof p?.progress === 'number' &&
            p.progress >= 0 &&
            p.progress < meta.trackLength);
        const stableLines = [];
        if (myColor)
            stableLines.push(`Couleur: ${myColor}.`);
        stableLines.push(`Départ: ${inStable}/4.`);
        stableLines.push(`Abri: ${inHome}/4.`);
        stableLines.push(`Arrivés: ${finished}/4.`);
        if (out.length) {
            const offset = meta.offsets?.[userId] ?? 0;
            const names = meta?.pawnNamesByPlayer?.[userId];
            for (const pawn of out) {
                const pos = (offset + pawn.progress) % meta.trackLength;
                const label = Array.isArray(names) && typeof names[pawn.pawnIndex] === 'string'
                    ? String(names[pawn.pawnIndex]).trim()
                    : `animal ${pawn.pawnIndex + 1}`;
                stableLines.push(`${label}: case ${pos + 1}/${meta.trackLength}.`);
            }
        }
        else {
            stableLines.push('Aucun animal sorti.');
        }
        const positionLines = [];
        const allOnTrack = [];
        for (const p of players) {
            if (!p)
                continue;
            const offset = meta.offsets?.[p.id] ?? 0;
            const names = meta?.pawnNamesByPlayer?.[p.id];
            const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id])
                ? meta.pawnsByPlayer[p.id]
                : [];
            for (const pawn of pawns) {
                const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
                if (prog < 0 || prog >= meta.trackLength)
                    continue;
                const pos = (offset + prog) % meta.trackLength;
                const label = Array.isArray(names) && typeof names[pawn.pawnIndex] === 'string'
                    ? String(names[pawn.pawnIndex]).trim()
                    : `animal ${pawn.pawnIndex + 1}`;
                allOnTrack.push({
                    pos,
                    line: `${label}, tour 0, case ${pos + 1}/${meta.trackLength}.`,
                });
            }
        }
        allOnTrack.sort((a, b) => b.pos - a.pos);
        positionLines.push(...allOnTrack.map((x) => x.line));
        if (!positionLines.length) {
            positionLines.push('Aucun animal sorti.');
        }
        const extras = {
            ...state.extras,
            currentPlayerView: {
                id: userId,
                username: me?.username ?? `Joueur ${userId}`,
                stable: stableLines,
                position: positionLines,
            },
            ui: {
                panels: {
                    stable: {
                        title: 'État',
                        message: stableLines.length
                            ? stableLines.join(' ')
                            : 'État: inconnu.',
                    },
                    position: {
                        title: 'Position',
                        message: positionLines.length
                            ? positionLines.join(' ')
                            : this.boardPayload.buildPositionPanelMessage({
                                tilesRaw: meta.tiles,
                                positionsRaw: meta.positions,
                                lapsRaw: meta.laps,
                                playerId: userId,
                            }),
                    },
                    score: {
                        title: 'Scores',
                        message: scoreLines.length
                            ? scoreLines.join('\n')
                            : 'Scores: indisponibles.',
                    },
                },
            },
        };
        const pendingForUser = state.pending && typeof state.pending?.playerId === 'number'
            ? state.pending.playerId === userId
                ? state.pending
                : null
            : (state.pending ?? null);
        return {
            ...state,
            catalog: {
                phases: game_definition_1.FOULEES_FANTASTIQUES_GAME.phaseOrder.map((p) => p.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions),
            pending: pendingForUser,
            extras,
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions, meta.laps),
        };
    }
};
exports.FouleesFantastiquesPresenterService = FouleesFantastiquesPresenterService;
exports.FouleesFantastiquesPresenterService = FouleesFantastiquesPresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [board_payload_service_1.BoardPayloadService])
], FouleesFantastiquesPresenterService);
//# sourceMappingURL=foulees-fantastiques-presenter.service.js.map