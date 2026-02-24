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
exports.CorridorPresenterService = void 0;
const common_1 = require("@nestjs/common");
const base_presenter_service_1 = require("../../../../engine/abstract/base-presenter.service");
const CorridorRulebook = __importStar(require("../rulebook/rulebook"));
const grid_blocked_edges_service_1 = require("../../../../modules/grid/services/grid-blocked-edges.service");
const grid_cell_actions_service_1 = require("../../../../modules/grid/services/grid-cell-actions.service");
let CorridorPresenterService = class CorridorPresenterService extends base_presenter_service_1.BasePresenterService {
    gridBlockedEdges;
    gridCellActions;
    constructor(gridBlockedEdges, gridCellActions) {
        super();
        this.gridBlockedEdges = gridBlockedEdges;
        this.gridCellActions = gridCellActions;
    }
    exposeStateForUser(state, userId) {
        const meta = (state.metadata ?? {});
        const exposed = this.buildExposedStateForUser(state, userId);
        if (!this.isStarted(state)) {
            return exposed;
        }
        const size = meta?.size ?? 0;
        if (!size || size <= 0) {
            return exposed;
        }
        const positions = {};
        for (const [pid, pos] of Object.entries(meta?.pawnsByPlayerId ?? {})) {
            if (!pos)
                continue;
            const idx = pos.y * size + pos.x;
            positions[String(pid)] = idx;
        }
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        const viewerIsTurn = currentPlayerId === userId;
        const cellActions = this.gridCellActions.buildFromActions(exposed.actions ?? [], (action) => {
            const payload = action?.payload ?? {};
            const type = String(action?.type ?? '').trim();
            const o = typeof payload?.o === 'string'
                ? String(payload.o).trim().toLowerCase()
                : '';
            if (type === 'corridor_move')
                return 'DÇ¸placer ici';
            if (type === 'corridor_place_wall' && o === 'h')
                return 'Mur horizontal ici';
            if (type === 'corridor_place_wall' && o === 'v')
                return 'Mur vertical ici';
            return String(action?.label ?? action?.type ?? '').trim();
        });
        const blockedEdges = this.gridBlockedEdges.buildFromWalls(size, meta?.walls);
        const cellTags = this.buildGridCellTags(state, userId, size);
        return {
            ...exposed,
            extras: {
                ...(exposed.extras ?? {}),
                grid: {
                    kind: 'grid',
                    size,
                    entities: Object.entries(meta?.pawnsByPlayerId ?? {}).map(([pid, pos]) => ({
                        id: `pawn:${pid}`,
                        type: 'pawn',
                        ownerId: Number(pid),
                        x: pos.x,
                        y: pos.y,
                        glyph: Number(pid) === userId ? '@' : 'O',
                    })),
                    blockedEdges,
                    cellActions,
                    cellTags,
                    statusLines: [
                        viewerIsTurn ? 'Ç? vous de jouer.' : "Tour de l'adversaire.",
                        `Murs restants : ${(meta?.wallsRemainingByPlayerId ?? {})[String(userId)] ?? 0}`,
                    ],
                },
            },
            board: {
                tiles: Array.from({ length: size * size }, (_, i) => ({
                    x: i % size,
                    y: Math.floor(i / size),
                })),
                positions,
            },
        };
    }
    buildGridCellTags(state, userId, size) {
        if (!size)
            return {};
        const players = state.players ?? [];
        const idx = players.findIndex((p) => p?.id === userId);
        if (idx < 0)
            return {};
        const goalY = idx === 0 ? size - 1 : 0;
        const tags = {};
        for (let x = 0; x < size; x++) {
            tags[`${x},${goalY}`] = ['Objectif'];
        }
        return tags;
    }
    buildCatalog() {
        return { phases: ['play'], victory: { type: 'reach_opposite_side' } };
    }
    getAvailableActionsForUser(state, userId) {
        if (!this.isStarted(state))
            return [];
        const current = this.getCurrentPlayerId(state);
        if (current == null || current !== userId)
            return [];
        const moves = CorridorRulebook.listLegalPawnMoves(state, userId);
        const walls = CorridorRulebook.listLegalWallPlacements(state, userId);
        return [
            ...moves.map((to) => ({
                type: 'corridor_move',
                payload: { x: to.x, y: to.y, _ui: { key: 'ENTER', kind: 'move' } },
            })),
            ...walls.map((w) => ({
                type: 'corridor_place_wall',
                payload: {
                    x: w.x,
                    y: w.y,
                    o: w.o,
                    _ui: { key: 'M', kind: 'place_wall' },
                },
            })),
        ];
    }
    buildPendingState() {
        return null;
    }
    buildExtras(state, _metadata, _currentPlayerId) {
        return this.getBaseExtras(state);
    }
    buildExtrasForUser(state, _metadata, _userId, _currentPlayerId) {
        return this.getBaseExtras(state);
    }
};
exports.CorridorPresenterService = CorridorPresenterService;
exports.CorridorPresenterService = CorridorPresenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [grid_blocked_edges_service_1.GridBlockedEdgesService,
        grid_cell_actions_service_1.GridCellActionsService])
], CorridorPresenterService);
//# sourceMappingURL=corridor-presenter.service.js.map