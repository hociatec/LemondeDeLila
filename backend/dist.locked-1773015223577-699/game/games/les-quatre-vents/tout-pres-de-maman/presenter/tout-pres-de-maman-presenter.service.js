"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ToutPresDeMamanPresenterService", {
    enumerable: true,
    get: function() {
        return ToutPresDeMamanPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _toutpresdemamandefinition = require("../definitions/tout-pres-de-maman.definition");
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
let ToutPresDeMamanPresenterService = class ToutPresDeMamanPresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = this.getMeta(state);
        const tokens = meta.tokens?.[userId] ?? 0;
        const totalNeeded = 3;
        const nextCard = this.peekNextCard(meta);
        const players = Array.isArray(state.players) ? state.players : [];
        const scoreLines = players.map((p)=>{
            const name = typeof p?.username === 'string' && p.username.trim().length > 0 ? p.username.trim() : `Joueur ${p?.id ?? '?'}`;
            const count = meta.tokens?.[p?.id ?? -1] ?? 0;
            return `${name} : ${count} eucalyptus`;
        });
        const stateRecord = asRecord(state);
        const baseExtras = asRecord(stateRecord.extras);
        return {
            ...state,
            catalog: {
                phases: _toutpresdemamandefinition.TOUT_PRES_DE_MAMAN_GAME.phaseOrder.map((phase)=>phase.id),
                victory: meta.winnerId != null ? {
                    winnerId: meta.winnerId
                } : null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions, ()=>'Lancer le dé'),
            pending: state.pending ?? null,
            extras: {
                ...baseExtras,
                tokens: `${tokens} / ${totalNeeded} jetons eucalyptus`,
                nextCard: nextCard?.text ?? 'Pile de cartes vide',
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
                            title: 'Eucalyptus',
                            message: scoreLines.length ? scoreLines.join('\n') : 'Eucalyptus: indisponible.'
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
    peekNextCard(meta) {
        const deck = Array.isArray(meta.deckCards) ? meta.deckCards : [];
        if (!deck.length) return null;
        const id = deck[0];
        return meta.cards.find((card)=>card.id === id) ?? null;
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
ToutPresDeMamanPresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], ToutPresDeMamanPresenterService);
function asRecord(value) {
    if (value == null || typeof value !== 'object') return {};
    return value;
}
