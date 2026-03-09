"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PrimalisPresenterService", {
    enumerable: true,
    get: function() {
        return PrimalisPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _primalisdefinition = require("../definitions/primalis.definition");
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
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
let PrimalisPresenterService = class PrimalisPresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = this.getMeta(state);
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p)=>p?.id === userId);
        const myResources = this.getResources(meta, userId);
        const scoreLines = players.map((p)=>{
            const name = typeof p?.username === 'string' && p.username.trim().length > 0 ? p.username.trim() : `Joueur ${p?.id ?? '?'}`;
            const resources = this.getResources(meta, p?.id ?? -1);
            return `${name} : Feuilles ${resources.leaves}, Herbivores ${resources.herbivores}, Carnivores ${resources.carnivores}`;
        });
        return {
            ...state,
            catalog: {
                phases: _primalisdefinition.PRIMALIS_GAME.phaseOrder.map((p)=>p.id),
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
                        ressources: {
                            title: 'Tribu',
                            message: this.renderResources(myResources)
                        },
                        score: {
                            title: 'Score',
                            message: scoreLines.length ? scoreLines.join('\n') : 'Score: indisponible.'
                        }
                    }
                }
            },
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions)
        };
    }
    renderResources(resources) {
        const pieces = [
            `Herbivores: ${resources.herbivores}`,
            `Carnivores: ${resources.carnivores}`,
            `Œufs: ${resources.eggs}`,
            `Feuilles: ${resources.leaves}`
        ];
        return pieces.join(' | ');
    }
    getResources(meta, playerId) {
        return meta.collections?.[playerId] ?? {
            herbivores: 0,
            carnivores: 0,
            eggs: 0,
            leaves: 0
        };
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
PrimalisPresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], PrimalisPresenterService);
