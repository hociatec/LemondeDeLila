"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CerclesSacresService", {
    enumerable: true,
    get: function() {
        return CerclesSacresService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/rulebook"));
const _cerclessacresactionservice = require("./actions/cercles-sacres-action.service");
const _cerclessacrespresenterservice = require("./presenter/cercles-sacres-presenter.service");
const _cerclessacressetupservice = require("./setup/cercles-sacres-setup.service");
const _cerclessacresbotservice = require("./bots/cercles-sacres-bot.service");
const _gamedefinition = require("./definitions/game.definition");
const _cerclessacresshortcuts = require("./cercles-sacres.shortcuts");
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
let CerclesSacresService = class CerclesSacresService extends _abstractgameservice.AbstractGameService {
    hydrateInitialState(baseState) {
        return this.setup.hydrateInitialState(baseState);
    }
    applyActions(state, actions) {
        return this.actions.applyActions(state, actions);
    }
    getAvailableActions(state, playerId) {
        return _rulebook.getAvailableActions(state, playerId);
    }
    validateAction(state, action, actorId) {
        return _rulebook.validateAction(state, action, actorId);
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
    getBotActions(state, botPlayerId) {
        return this.bots.getBotActions(state, botPlayerId);
    }
    getShortcuts(ctx) {
        return (0, _cerclessacresshortcuts.buildCerclesSacresShortcuts)(ctx);
    }
    constructor(registry, setup, actions, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.presenter = presenter, this.bots = bots, this.gameType = 'cercles-sacres', this.category = 'JeuxDePlateaux', this.subcategory = 'VentsDansants', this.displayName = _gamedefinition.CERCLES_SACRES_GAME.displayName, this.description = 'Formez trois Cercles Sacrés en alignant six cartes thématiques.', this.minPlayers = _gamedefinition.CERCLES_SACRES_GAME.minPlayers, this.maxPlayers = _gamedefinition.CERCLES_SACRES_GAME.maxPlayers;
    }
};
CerclesSacresService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _cerclessacressetupservice.CerclesSacresSetupService === "undefined" ? Object : _cerclessacressetupservice.CerclesSacresSetupService,
        typeof _cerclessacresactionservice.CerclesSacresActionService === "undefined" ? Object : _cerclessacresactionservice.CerclesSacresActionService,
        typeof _cerclessacrespresenterservice.CerclesSacresPresenterService === "undefined" ? Object : _cerclessacrespresenterservice.CerclesSacresPresenterService,
        typeof _cerclessacresbotservice.CerclesSacresBotService === "undefined" ? Object : _cerclessacresbotservice.CerclesSacresBotService
    ])
], CerclesSacresService);
