"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CorridorService", {
    enumerable: true,
    get: function() {
        return CorridorService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _corridorsetupservice = require("./setup/corridor-setup.service");
const _corridoractionservice = require("./actions/corridor-action.service");
const _corridorpresenterservice = require("./presenter/corridor-presenter.service");
const _gamedefinition = require("./definitions/game.definition");
const _corridorbotservice = require("./bots/corridor-bot.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/rulebook"));
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
let CorridorService = class CorridorService extends _abstractgameservice.AbstractGameService {
    hydrateInitialState(baseState) {
        return this.setup.hydrateInitialState(baseState);
    }
    applyActions(state, actions) {
        return this.actions.applyActions(state, actions);
    }
    // Used by the engine to:
    // - expose `game.actions` when requested
    // - allow explicit "out of turn" actions (ex: pending choose_pawn while currentPlayerId is wrong/outdated).
    getAvailableActions(state, playerId) {
        if (!state || String(state.status ?? '').trim().toLowerCase() !== 'started') {
            return [];
        }
        const pendingType = String(state.pending?.type ?? '').trim().toLowerCase();
        if (pendingType === 'choose_pawn') {
            if (state.pending?.playerId !== playerId) {
                return [];
            }
            const pawns = Array.isArray(state.pending?.data?.pawns) ? (state.pending?.data).pawns : [];
            return pawns.map((pawn)=>{
                const id = String(pawn?.id ?? '').trim();
                if (!id) return null;
                return {
                    type: 'choose_pawn',
                    payload: {
                        pawnId: id
                    },
                    label: String(pawn?.label ?? id).trim()
                };
            }).filter((a)=>a != null);
        }
        // Any other pending state blocks gameplay actions for everyone.
        if (state.pending) {
            return [];
        }
        if (state.turn?.currentPlayerId !== playerId) {
            return [];
        }
        const moves = _rulebook.listLegalPawnMoves(state, playerId) ?? [];
        const walls = _rulebook.listLegalWallPlacements(state, playerId) ?? [];
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
    getBotActions(state, botPlayerId) {
        return this.bots.getBotActions(state, botPlayerId);
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
    constructor(registry, setup, actions, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.presenter = presenter, this.bots = bots, this.gameType = 'corridor', this.category = 'JeuxDePlateaux', this.subcategory = 'Les Vents Sacrés', this.displayName = _gamedefinition.CORRIDOR_GAME.displayName, this.description = 'Déplacez votre pion sur une grille (9×9) et atteignez le bord opposé.', this.minPlayers = _gamedefinition.CORRIDOR_GAME.minPlayers, this.maxPlayers = _gamedefinition.CORRIDOR_GAME.maxPlayers;
        this.registry = registry;
    }
};
CorridorService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _corridorsetupservice.CorridorSetupService === "undefined" ? Object : _corridorsetupservice.CorridorSetupService,
        typeof _corridoractionservice.CorridorActionService === "undefined" ? Object : _corridoractionservice.CorridorActionService,
        typeof _corridorpresenterservice.CorridorPresenterService === "undefined" ? Object : _corridorpresenterservice.CorridorPresenterService,
        typeof _corridorbotservice.CorridorBotService === "undefined" ? Object : _corridorbotservice.CorridorBotService
    ])
], CorridorService);
