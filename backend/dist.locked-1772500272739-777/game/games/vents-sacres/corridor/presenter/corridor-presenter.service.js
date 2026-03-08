"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CorridorPresenterService", {
    enumerable: true,
    get: function() {
        return CorridorPresenterService;
    }
});
const _common = require("@nestjs/common");
const _basepresenterservice = require("../../../../engine/abstract/base-presenter.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gridblockededgesservice = require("../../../../modules/grid/services/grid-blocked-edges.service");
const _gridcellactionsservice = require("../../../../modules/grid/services/grid-cell-actions.service");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let CorridorPresenterService = class CorridorPresenterService extends _basepresenterservice.BasePresenterService {
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const exposed = this.buildExposedStateForUser(state, userId);
        // En setup/finished: on retourne uniquement l'état "table" (pas de grille/plateau).
        if (!this.isStarted(state)) {
            return exposed;
        }
        const size = meta?.size ?? 0;
        if (!size || size <= 0) {
            return exposed;
        }
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        const viewerIsTurn = currentPlayerId === userId;
        const cellActions = this.gridCellActions.buildFromActions(exposed.actions ?? [], (action)=>{
            const payload = action?.payload ?? {};
            const type = String(action?.type ?? '').trim();
            const o = typeof payload?.o === 'string' ? String(payload.o).trim().toLowerCase() : '';
            if (type === 'corridor_move') return 'Déplacer ici';
            if (type === 'corridor_place_wall' && o === 'h') return 'Mur horizontal ici';
            if (type === 'corridor_place_wall' && o === 'v') return 'Mur vertical ici';
            return String(action?.label ?? action?.type ?? '').trim();
        });
        const blockedEdges = this.gridBlockedEdges.buildFromWalls(size, meta?.walls);
        const cellTags = this.buildGridCellTags(state, userId, size);
        const exposedExtras = exposed.extras && typeof exposed.extras === 'object' ? exposed.extras : {};
        const existingUi = exposedExtras.ui && typeof exposedExtras.ui === 'object' ? exposedExtras.ui : {};
        const existingPanels = existingUi.panels && typeof existingUi.panels === 'object' ? existingUi.panels : {};
        return {
            ...exposed,
            extras: {
                ...exposed.extras ?? {},
                ui: {
                    ...existingUi,
                    panels: {
                        ...existingPanels,
                        position: {
                            title: 'Positions',
                            message: this.buildPositionPanelMessage(state, size)
                        }
                    }
                },
                grid: {
                    kind: 'grid',
                    size,
                    entities: Object.entries(meta?.pawnsByPlayerId ?? {}).map(([pid, pos])=>({
                            id: `pawn:${pid}`,
                            type: 'pawn',
                            ownerId: Number(pid),
                            x: pos.x,
                            y: pos.y,
                            glyph: Number(pid) === userId ? '@' : 'O'
                        })),
                    blockedEdges,
                    cellActions,
                    cellTags,
                    statusLines: [
                        viewerIsTurn ? 'À vous de jouer.' : "Tour de l'adversaire.",
                        `Murs restants : ${(meta?.wallsRemainingByPlayerId ?? {})[String(userId)] ?? 0}`
                    ]
                }
            }
        };
    }
    buildPositionPanelMessage(state, size) {
        const players = Array.isArray(state.players) ? state.players : [];
        const byId = new Map();
        for (const p of players){
            if (!p || typeof p.id !== 'number') continue;
            const name = String(p.username ?? '').trim();
            byId.set(p.id, name.length > 0 ? name : `Joueur ${p.id}`);
        }
        const meta = state.metadata ?? {};
        const positions = meta?.pawnsByPlayerId ?? {};
        const entries = [];
        for (const [pidRaw, pos] of Object.entries(positions)){
            if (!pos) continue;
            const pid = Number(pidRaw);
            const name = Number.isFinite(pid) ? byId.get(pid) ?? `Joueur ${pid}` : `Joueur ${pidRaw}`;
            entries.push(`${name} ${this.toCellRef(pos.x ?? 0, pos.y ?? 0, size).toLowerCase()}`);
        }
        if (entries.length === 0) {
            return 'Positions inconnues.';
        }
        return `Positions. ${entries.join('. ')}.`;
    }
    toCellRef(x, y, size) {
        const safeSize = Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;
        if (safeSize <= 0) {
            return `${x},${y}`;
        }
        let n = Math.max(1, Math.trunc(Number(x) + 1));
        let col = '';
        while(n > 0){
            n -= 1;
            col = String.fromCharCode(65 + n % 26) + col;
            n = Math.floor(n / 26);
        }
        const row = Math.max(1, safeSize - Math.trunc(Number(y)));
        return `${col}${row}`;
    }
    buildGridCellTags(state, userId, size) {
        if (!size) return {};
        const players = state.players ?? [];
        const idx = players.findIndex((p)=>p?.id === userId);
        if (idx < 0) return {};
        const goalY = idx === 0 ? size - 1 : 0;
        const tags = {};
        for(let x = 0; x < size; x++){
            tags[`${x},${goalY}`] = [
                'Objectif'
            ];
        }
        return tags;
    }
    buildCatalog() {
        return {
            phases: [
                'play'
            ],
            victory: {
                type: 'reach_opposite_side'
            }
        };
    }
    getAvailableActionsForUser(state, userId) {
        if (!this.isStarted(state)) return [];
        const current = this.getCurrentPlayerId(state);
        if (current == null || current !== userId) return [];
        const moves = _rulebook.listLegalPawnMoves(state, userId);
        const walls = _rulebook.listLegalWallPlacements(state, userId);
        return [
            ...moves.map((to)=>({
                    type: 'corridor_move',
                    payload: {
                        x: to.x,
                        y: to.y,
                        _ui: {
                            key: 'ENTER',
                            kind: 'move'
                        }
                    }
                })),
            ...walls.map((w)=>({
                    type: 'corridor_place_wall',
                    payload: {
                        x: w.x,
                        y: w.y,
                        o: w.o,
                        _ui: {
                            key: 'M',
                            kind: 'place_wall'
                        }
                    }
                }))
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
    constructor(gridBlockedEdges, gridCellActions){
        super(), this.gridBlockedEdges = gridBlockedEdges, this.gridCellActions = gridCellActions;
    }
};
CorridorPresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gridblockededgesservice.GridBlockedEdgesService === "undefined" ? Object : _gridblockededgesservice.GridBlockedEdgesService,
        typeof _gridcellactionsservice.GridCellActionsService === "undefined" ? Object : _gridcellactionsservice.GridCellActionsService
    ])
], CorridorPresenterService);
