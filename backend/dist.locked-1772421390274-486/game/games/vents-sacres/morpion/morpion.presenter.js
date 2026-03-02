"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MorpionPresenter", {
    enumerable: true,
    get: function() {
        return MorpionPresenter;
    }
});
const _common = require("@nestjs/common");
const _basepresenterservice = require("../../../engine/abstract/base-presenter.service");
const _gridcellactionsservice = require("../../../modules/grid/services/grid-cell-actions.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let MorpionPresenter = class MorpionPresenter extends _basepresenterservice.BasePresenterService {
    exposeStateForUser(state, userId) {
        const meta = state.metadata ?? {};
        const exposed = this.buildExposedStateForUser(state, userId);
        if (!this.isStarted(state)) {
            return exposed;
        }
        const size = meta.size ?? 3;
        const board = Array.isArray(meta.board) ? meta.board : [];
        const players = state.players ?? [];
        const player0 = players[0]?.id ?? 1;
        const player1 = players[1]?.id ?? 2;
        const entities = [];
        for(let y = 0; y < size; y++){
            for(let x = 0; x < size; x++){
                const idx = y * size + x;
                const ownerId = board[idx] ?? 0;
                if (!ownerId) continue;
                const glyph = ownerId === player0 ? 'X' : ownerId === player1 ? 'O' : '@';
                entities.push({
                    id: `mark:${idx}`,
                    type: 'mark',
                    ownerId,
                    x,
                    y,
                    glyph
                });
            }
        }
        const cellActions = this.gridCellActions.buildFromActions(exposed.actions ?? [], ()=>'Jouer ici');
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        const winnerId = meta?.winnerId ?? null;
        const draw = Boolean(meta?.draw);
        const statusLines = [
            winnerId ? `Gagnant : ${players.find((p)=>p?.id === winnerId)?.username ?? `#${winnerId}`}` : draw ? 'Match nul.' : currentPlayerId === userId ? 'À vous de jouer.' : "Tour de l'adversaire."
        ];
        return {
            ...exposed,
            extras: {
                ...exposed.extras ?? {},
                grid: {
                    kind: 'grid',
                    size,
                    entities,
                    cellActions,
                    statusLines
                }
            },
            board: {
                tiles: Array.from({
                    length: size * size
                }, (_, i)=>({
                        x: i % size,
                        y: Math.floor(i / size)
                    }))
            }
        };
    }
    buildCatalog() {
        return {
            phases: [
                'play'
            ],
            victory: {
                type: 'line_3'
            }
        };
    }
    getAvailableActionsForUser(state, userId) {
        if (!this.isStarted(state)) return [];
        if (state.turn?.currentPlayerId !== userId) return [];
        const meta = state.metadata ?? {};
        const size = meta.size ?? 3;
        const board = Array.isArray(meta.board) ? meta.board : [];
        const out = [];
        for(let y = 0; y < size; y++){
            for(let x = 0; x < size; x++){
                const idx = y * size + x;
                if ((board[idx] ?? 0) !== 0) continue;
                out.push({
                    type: 'morpion_play',
                    payload: {
                        x,
                        y,
                        _ui: {
                            key: 'ENTER',
                            kind: 'play'
                        }
                    }
                });
            }
        }
        return out;
    }
    buildPendingState() {
        return null;
    }
    buildExtras(state, _metadata, _currentPlayerId) {
        return this.getBaseExtras(state);
    }
    buildExtrasForUser(state, _metadata, _userId, currentPlayerId) {
        const base = this.getBaseExtras(state);
        const meta = state.metadata ?? {};
        const size = meta.size ?? 3;
        const board = Array.isArray(meta.board) ? meta.board : [];
        const players = Array.isArray(state.players) ? state.players : [];
        const glyphForOwner = (ownerId)=>{
            const player0 = players[0]?.id ?? 1;
            const player1 = players[1]?.id ?? 2;
            if (ownerId === player0) return 'X';
            if (ownerId === player1) return 'O';
            return '@';
        };
        const rowLabel = (y)=>{
            const cells = [];
            for(let x = 0; x < size; x += 1){
                const idx = y * size + x;
                const ownerId = Number(board[idx] ?? 0);
                cells.push(ownerId ? glyphForOwner(ownerId) : '.');
            }
            return cells.join(' ');
        };
        const boardMessage = [
            `Plateau:`,
            rowLabel(0),
            rowLabel(1),
            rowLabel(2)
        ].join(' ');
        const emptyCount = board.filter((v)=>Number(v ?? 0) === 0).length;
        const who = typeof currentPlayerId === 'number' ? players.find((p)=>p?.id === currentPlayerId)?.username ?? `#${currentPlayerId}` : 'inconnu';
        const playInfo = String(state.status ?? '').toLowerCase() === 'started' ? `Cases libres: ${emptyCount}. Entrée: jouer sur la case focus.` : 'Partie non démarrée.';
        return {
            ...base,
            ui: {
                panels: {
                    position: {
                        title: 'Plateau',
                        message: `Tour: ${who}. ${boardMessage}`.trim()
                    },
                    play: {
                        title: 'Coups',
                        message: playInfo
                    }
                }
            }
        };
    }
    constructor(gridCellActions){
        super(), this.gridCellActions = gridCellActions;
    }
};
MorpionPresenter = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gridcellactionsservice.GridCellActionsService === "undefined" ? Object : _gridcellactionsservice.GridCellActionsService
    ])
], MorpionPresenter);
