"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TaxiExpressPresenterService", {
    enumerable: true,
    get: function() {
        return TaxiExpressPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _taxiexpressdefinition = require("../definitions/taxi-express.definition");
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
const TRIPS_TO_WIN = 5;
let TaxiExpressPresenterService = class TaxiExpressPresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = this.getMeta(state);
        const client = this.getActiveClient(meta, userId);
        const event = this.getActiveEvent(meta);
        const completed = meta.completedTrips?.[userId] ?? 0;
        const players = Array.isArray(state.players) ? state.players : [];
        const scoreLines = players.map((p)=>{
            const name = typeof p?.username === 'string' && p.username.trim().length > 0 ? p.username.trim() : `Joueur ${p?.id ?? '?'}`;
            const count = meta.completedTrips?.[p?.id ?? -1] ?? 0;
            return `${name} : ${count} trajet${count > 1 ? 's' : ''}`;
        });
        const stateRecord = asRecord(state);
        const baseExtras = asRecord(stateRecord.extras);
        return {
            ...state,
            catalog: {
                phases: _taxiexpressdefinition.TAXI_EXPRESS_GAME.phaseOrder.map((phase)=>phase.id),
                victory: meta.winnerId != null ? {
                    winnerId: meta.winnerId
                } : null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions, ()=>'Lancer le dé'),
            pending: state.pending ?? null,
            extras: {
                ...baseExtras,
                taxi: {
                    currentClient: client ? `${client.clientName} vers ${this.tileTitle(meta, client.destinationId)}` : 'Aucun client à bord.',
                    route: client?.route ?? 'Aucun trajet en cours.',
                    stats: `Trajets complétés : ${completed} / ${TRIPS_TO_WIN}`,
                    event: event ? `${event.title} bloque ${this.tileTitle(meta, event.blockedTileId)}.` : 'Pas d’obstacle identifié.'
                },
                ui: {
                    panels: {
                        position: {
                            title: 'Position',
                            message: this.boardPayload.buildPositionPanelMessage({
                                tilesRaw: meta.tiles,
                                positionsRaw: meta.positions,
                                playerId: userId
                            })
                        },
                        score: {
                            title: 'Trajets',
                            message: scoreLines.length ? scoreLines.join('\n') : 'Trajets: indisponible.'
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
    getActiveClient(meta, playerId) {
        const id = meta.activeClients?.[playerId] ?? null;
        if (id == null) return null;
        return meta.clients.find((client)=>client.id === id) ?? null;
    }
    getActiveEvent(meta) {
        if (meta.lastEventId == null) return null;
        return meta.events.find((event)=>event.id === meta.lastEventId) ?? null;
    }
    tileTitle(meta, tileId) {
        if (tileId == null) return 'case inconnue';
        const index = (meta.tiles ?? []).findIndex((tile)=>tile.id === tileId);
        const tile = index >= 0 ? meta.tiles[index] : null;
        return tile?.title ?? `case ${tileId}`;
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
TaxiExpressPresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], TaxiExpressPresenterService);
function asRecord(value) {
    if (value == null || typeof value !== 'object') return {};
    return value;
}
