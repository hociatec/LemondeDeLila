"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MonVillagePresenterService", {
    enumerable: true,
    get: function() {
        return MonVillagePresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _monvillagedefinition = require("../definitions/mon-village.definition");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
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
const ZONE_LABELS = {
    1: 'Terre & Nature',
    2: 'Artisanat',
    3: 'Textile & Habillement',
    4: 'Bouche',
    5: 'Quotidien & Services',
    6: 'Savoir & Culture',
    7: 'Protection & Société',
    8: 'Très anciens & universels'
};
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
let MonVillagePresenterService = class MonVillagePresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = state.metadata ?? {};
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p)=>p?.id === userId);
        const collection = meta.collections?.[userId] ?? null;
        const availableMessage = this.buildAvailableMessage(meta.decks ?? {});
        const scoreMessage = this.buildScoresMessage(players, meta.collections ?? {});
        return {
            ...state,
            catalog: {
                phases: _monvillagedefinition.MON_VILLAGE_GAME.phaseOrder.map((p)=>p.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions, (action)=>action.type === 'roll' ? 'Lancer le dé' : action.type),
            pending: state.pending ?? null,
            extras: {
                ...asRecord(state.extras),
                currentPlayerView: {
                    id: userId,
                    username: me?.username ?? `Joueur ${userId}`
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
                        cartes: {
                            title: 'Cartes',
                            message: this.buildCollectionMessage(collection)
                        },
                        available: {
                            title: 'Disponibles',
                            message: availableMessage
                        },
                        score: {
                            title: 'Scores',
                            message: scoreMessage
                        }
                    }
                }
            },
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions)
        };
    }
    buildCollectionMessage(collection) {
        if (!collection) {
            return 'Cartes totales : 0';
        }
        const lines = [
            `Cartes totales : ${collection.total}`
        ];
        const zoneEntries = Object.entries(collection.byZone ?? {}).map(([zoneId, count])=>({
                zoneId: Number(zoneId),
                label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
                count
            })).sort((a, b)=>a.zoneId - b.zoneId).map((entry)=>`${entry.label} (${entry.count})`);
        if (zoneEntries.length) {
            lines.push(zoneEntries.join(' | '));
        }
        return lines.join('\n');
    }
    buildAvailableMessage(decks) {
        const entries = Object.entries(decks ?? {}).map(([zoneId, cards])=>({
                zoneId: Number(zoneId),
                label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
                count: Array.isArray(cards) ? cards.length : 0
            })).sort((a, b)=>a.zoneId - b.zoneId);
        if (!entries.length) {
            return 'Aucune carte disponible.';
        }
        return entries.map((entry)=>`${entry.label} (${entry.count})`).join(' | ');
    }
    buildScoresMessage(players, collections) {
        if (!players.length) return 'Scores: indisponibles.';
        const lines = players.map((p)=>{
            const name = typeof p?.username === 'string' && p.username.trim().length > 0 ? p.username.trim() : `Joueur ${p?.id ?? '?'}`;
            const collection = collections?.[p?.id ?? -1] ?? null;
            if (!collection) return `${name} : 0`;
            const zoneEntries = Object.entries(collection.byZone ?? {}).map(([zoneId, count])=>({
                    zoneId: Number(zoneId),
                    label: ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`,
                    count
                })).sort((a, b)=>a.zoneId - b.zoneId).map((entry)=>`${entry.label} (${entry.count})`);
            const total = collection.total ?? 0;
            return zoneEntries.length ? `${name} : ${total} | ${zoneEntries.join(' | ')}` : `${name} : ${total}`;
        });
        return lines.join('\n');
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
MonVillagePresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], MonVillagePresenterService);
