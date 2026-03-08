"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AFondLesBallonsPresenterService", {
    enumerable: true,
    get: function() {
        return AFondLesBallonsPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gamedefinition = require("../definitions/game.definition");
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
let AFondLesBallonsPresenterService = class AFondLesBallonsPresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = state.metadata ?? {};
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p)=>p?.id === userId);
        const stateRecord = state;
        const stateExtras = asRecord(stateRecord.extras);
        const extras = {
            ...stateExtras,
            currentPlayerView: {
                id: userId,
                username: me?.username ?? `Joueur ${userId}`
            },
            ui: {
                panels: {
                    position: {
                        title: 'Position',
                        message: this.buildAllPlayersPositionMessage(meta.tiles, meta.positions, players)
                    }
                }
            }
        };
        return {
            ...state,
            catalog: {
                phases: _gamedefinition.A_FOND_LES_BALLONS_GAME.phaseOrder.map((p)=>p.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            pending: state.pending ?? null,
            extras,
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions)
        };
    }
    buildAllPlayersPositionMessage(tilesRaw, positionsRaw, playersRaw) {
        const board = this.boardPayload.buildTilesPositionsLaps(tilesRaw, positionsRaw);
        const totalTiles = Array.isArray(board.tiles) ? board.tiles.length : 0;
        const positions = board.positions ?? {};
        if (totalTiles <= 0 || Object.keys(positions).length === 0) {
            return 'Position: inconnue.';
        }
        const players = Array.isArray(playersRaw) ? playersRaw : [];
        const namesById = new Map();
        for (const p of players){
            if (!p || typeof p.id !== 'number') continue;
            const name = String(p.username ?? '').trim();
            namesById.set(p.id, name.length > 0 ? name : `Joueur ${p.id}`);
        }
        const parts = Object.entries(positions).map(([playerIdRaw, posRaw])=>{
            const playerId = Number(playerIdRaw);
            const name = Number.isFinite(playerId) ? namesById.get(playerId) ?? `Joueur ${playerId}` : `Joueur ${playerIdRaw}`;
            const pos = Number(posRaw);
            const caseNumber = Number.isFinite(pos) ? Math.max(1, Math.trunc(pos) + 1) : null;
            if (caseNumber == null) {
                return null;
            }
            return `${name} case ${caseNumber}/${totalTiles}`;
        }).filter((entry)=>typeof entry === 'string');
        if (parts.length === 0) {
            return 'Position: inconnue.';
        }
        return `Positions. ${parts.join('. ')}.`;
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
AFondLesBallonsPresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], AFondLesBallonsPresenterService);
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
