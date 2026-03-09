"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SacAMalicesPresenterService", {
    enumerable: true,
    get: function() {
        return SacAMalicesPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _sacamalicesdefinition = require("../definitions/sac-a-malices.definition");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _sacamalicesvariants = require("../sac-a-malices-variants");
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
let SacAMalicesPresenterService = class SacAMalicesPresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = state.metadata ?? {};
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p)=>p?.id === userId);
        const money = meta.money?.[userId] ?? 0;
        const pending = this.buildVariantPrompt(meta, players, userId) ?? state.pending ?? null;
        const propertyPanels = this.buildPropertyPanels(meta, players, userId);
        const stateRecord = state;
        const extrasBase = stateRecord.extras && typeof stateRecord.extras === 'object' ? stateRecord.extras : {};
        return {
            ...state,
            catalog: {
                phases: _sacamalicesdefinition.SAC_A_MALICES_GAME.phaseOrder.map((p)=>p.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            pending,
            extras: {
                ...extrasBase,
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
                        cash: {
                            title: 'Caisse',
                            message: `${money} €`
                        },
                        parcGratuit: {
                            title: 'Parc Gratuit',
                            message: `Pot: ${meta.pot ?? 0} €`
                        },
                        properties_all: {
                            title: 'Propriétés',
                            message: propertyPanels.all
                        },
                        properties_mine: {
                            title: 'Mes propriétés',
                            message: propertyPanels.mine
                        },
                        properties_others: {
                            title: 'Propriétés des autres',
                            message: propertyPanels.others
                        },
                        properties_available: {
                            title: 'Propriétés disponibles',
                            message: propertyPanels.available
                        }
                    }
                }
            },
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions)
        };
    }
    buildVariantPrompt(meta, players, userId) {
        if ((meta.setupStep ?? '') !== 'setup_config') return null;
        const metadataRecord = meta;
        const rawOwnerId = metadataRecord.ownerPlayerId;
        const ownerId = typeof rawOwnerId === 'number' ? rawOwnerId : players[0]?.id ?? null;
        if (ownerId == null || ownerId !== userId) return null;
        const choices = _sacamalicesvariants.SAC_VARIANTS.map((variant)=>variant.label).filter((label)=>label && label.trim());
        if (choices.length === 0) {
            return null;
        }
        return {
            type: 'sac_setup_variant',
            playerId: ownerId,
            label: 'Choisissez votre Monopoly',
            blocking: true,
            choices
        };
    }
    buildPropertyPanels(meta, players, userId) {
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const ownership = meta.ownership ?? {};
        const nameById = new Map(players.filter((p)=>typeof p?.id === 'number').map((p)=>[
                p.id,
                typeof p?.username === 'string' && p.username.trim().length > 0 ? p.username.trim() : `Joueur ${p.id}`
            ]));
        const ownable = tiles.map((tile, idx)=>({
                tile,
                idx
            })).filter(({ tile })=>[
                'property',
                'station',
                'utility'
            ].includes(String(tile?.type ?? '')));
        const formatTile = (_idx, title, ownerId)=>{
            if (ownerId == null) return `${title} (libre)`;
            const ownerName = nameById.get(ownerId) ?? `Joueur ${ownerId}`;
            return `${title} (${ownerName})`;
        };
        const all = ownable.map(({ tile, idx })=>formatTile(idx, tile.title ?? `Case ${idx + 1}`, ownership[idx] ?? null));
        const mine = ownable.filter(({ idx })=>ownership[idx] === userId).map(({ tile, idx })=>formatTile(idx, tile.title ?? `Case ${idx + 1}`, userId));
        const others = ownable.filter(({ idx })=>ownership[idx] != null && ownership[idx] !== userId).map(({ tile, idx })=>formatTile(idx, tile.title ?? `Case ${idx + 1}`, ownership[idx]));
        const available = ownable.filter(({ idx })=>ownership[idx] == null).map(({ tile, idx })=>formatTile(idx, tile.title ?? `Case ${idx + 1}`, null));
        return {
            all: all.length ? all.join('\n') : 'Aucune propriété.',
            mine: mine.length ? mine.join('\n') : 'Aucune propriété.',
            others: others.length ? others.join('\n') : 'Aucune propriété.',
            available: available.length ? available.join('\n') : 'Aucune propriété.'
        };
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
SacAMalicesPresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], SacAMalicesPresenterService);
