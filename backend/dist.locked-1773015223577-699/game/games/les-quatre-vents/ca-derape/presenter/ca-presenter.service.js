"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CaPresenterService", {
    enumerable: true,
    get: function() {
        return CaPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _cadefinition = require("../definitions/ca.definition");
const _carulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/ca.rulebook"));
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
let CaPresenterService = class CaPresenterService {
    buildPositionMessage(meta, playerId) {
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const pos = meta.positions?.[playerId];
        if (!Number.isFinite(pos) || tiles.length <= 0) {
            return 'Position: inconnue.';
        }
        const tile = tiles[Math.max(0, Math.min(tiles.length - 1, pos))];
        const caseNumber = Math.max(1, Math.trunc(pos) + 1);
        const total = tiles.length;
        const label = String(tile?.label ?? '').trim();
        const desc = String(tile?.description ?? '').trim();
        const isNeutral = Boolean(tile?.isNeutral);
        const kindLabel = isNeutral ? 'Case neutre' : 'Carte obligatoire';
        const parts = [
            `Case ${caseNumber}/${total}${label ? ` - ${label}` : ''}.`,
            desc ? desc : null,
            `Type: ${kindLabel}.`
        ].filter(Boolean);
        return parts.join(' ');
    }
    exposeStateForUser(state, userId) {
        const actions = _carulebook.getAvailableActions(state, userId);
        const meta = this.getMeta(state);
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p)=>p?.id === userId);
        return {
            ...state,
            catalog: {
                phases: _cadefinition.CA_DERAPE_GAME.phaseOrder.map((p)=>p.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            pending: state.pending ?? null,
            extras: {
                ...asRecord(asRecord(state).extras),
                currentPlayerView: {
                    id: userId,
                    username: me?.username ?? `Joueur ${userId}`
                },
                ui: {
                    panels: {
                        position: {
                            title: 'Position',
                            message: this.buildPositionMessage(meta, userId)
                        }
                    }
                }
            },
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions)
        };
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
CaPresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], CaPresenterService);
function asRecord(value) {
    if (value == null || typeof value !== 'object') return {};
    return value;
}
