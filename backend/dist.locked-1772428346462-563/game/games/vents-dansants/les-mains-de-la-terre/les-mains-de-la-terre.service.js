"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LesMainsDeLaTerreService", {
    enumerable: true,
    get: function() {
        return LesMainsDeLaTerreService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/rulebook"));
const _lesmainsdelaterreactionservice = require("./actions/les-mains-de-la-terre-action.service");
const _lesmainsdelaterrebotservice = require("./bots/les-mains-de-la-terre-bot.service");
const _lesmainsdelaterrepresenterservice = require("./presenter/les-mains-de-la-terre-presenter.service");
const _lesmainsdelaterresetupservice = require("./setup/les-mains-de-la-terre-setup.service");
const _gamedefinition = require("./definitions/game.definition");
const _lesmainsdelaterreshortcuts = require("./les-mains-de-la-terre.shortcuts");
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
let LesMainsDeLaTerreService = class LesMainsDeLaTerreService extends _abstractgameservice.AbstractGameService {
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
        return (0, _lesmainsdelaterreshortcuts.buildLesMainsDeLaTerreShortcuts)(ctx);
    }
    constructor(registry, setup, actions, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.presenter = presenter, this.bots = bots, this.gameType = _gamedefinition.LES_MAINS_GAME.id, this.category = 'JeuxDePlateaux', this.subcategory = 'VentsDansants', this.displayName = _gamedefinition.LES_MAINS_GAME.displayName, this.description = 'Complétez des familles de métiers tout en jouant des cartes spéciales déboussolantes.', this.minPlayers = _gamedefinition.LES_MAINS_GAME.minPlayers, this.maxPlayers = _gamedefinition.LES_MAINS_GAME.maxPlayers;
    }
};
LesMainsDeLaTerreService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _lesmainsdelaterresetupservice.LesMainsSetupService === "undefined" ? Object : _lesmainsdelaterresetupservice.LesMainsSetupService,
        typeof _lesmainsdelaterreactionservice.LesMainsActionService === "undefined" ? Object : _lesmainsdelaterreactionservice.LesMainsActionService,
        typeof _lesmainsdelaterrepresenterservice.LesMainsPresenterService === "undefined" ? Object : _lesmainsdelaterrepresenterservice.LesMainsPresenterService,
        typeof _lesmainsdelaterrebotservice.LesMainsDeLaTerreBotService === "undefined" ? Object : _lesmainsdelaterrebotservice.LesMainsDeLaTerreBotService
    ])
], LesMainsDeLaTerreService);
