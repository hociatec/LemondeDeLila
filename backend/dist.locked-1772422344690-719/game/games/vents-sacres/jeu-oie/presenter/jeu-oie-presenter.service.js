"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "JeuOiePresenterService", {
    enumerable: true,
    get: function() {
        return JeuOiePresenterService;
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
let JeuOiePresenterService = class JeuOiePresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = state.metadata ?? {};
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p)=>p?.id === userId);
        const extras = {
            ...state.extras,
            currentPlayerView: {
                id: userId,
                username: me?.username ?? `Joueur ${userId}`
            },
            ui: {
                panels: {
                    position: {
                        title: 'Position',
                        message: this.buildPositionMessage(meta, userId)
                    },
                    board: {
                        title: 'Plateau',
                        message: this.buildBoardMessage(meta)
                    }
                }
            }
        };
        return {
            ...state,
            catalog: {
                phases: _gamedefinition.JEU_OIE_GAME.phaseOrder.map((p)=>p.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            pending: state.pending ?? null,
            extras,
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions, meta.laps)
        };
    }
    buildPositionMessage(meta, userId) {
        const tiles = Array.isArray(meta?.tiles) ? meta.tiles : [];
        const posRaw = meta?.positions?.[userId];
        const pos = typeof posRaw === 'number' ? posRaw : Number(posRaw);
        if (!Number.isFinite(pos) || tiles.length === 0) {
            return 'Position: inconnue.';
        }
        const startIndex = tiles.findIndex((t)=>t?.type === 'start');
        const finishIndex = tiles.findIndex((t)=>t?.type === 'finish');
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
        const startIndex = tiles.findIndex((t)=>t?.type === 'start');
        const finishIndex = tiles.findIndex((t)=>t?.type === 'finish');
        const from = startIndex >= 0 ? startIndex : 0;
        const to = finishIndex >= 0 ? finishIndex : tiles.length - 1;
        const lines = [];
        for(let i = from; i <= to; i += 1){
            const t = tiles[i];
            const label = String(t?.label ?? '').trim() || `Case ${i}`;
            lines.push(`${i}: ${label}.`);
        }
        return lines.join('\n');
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
JeuOiePresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], JeuOiePresenterService);
