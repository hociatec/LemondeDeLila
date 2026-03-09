"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SacAMalicesService", {
    enumerable: true,
    get: function() {
        return SacAMalicesService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _sacamalicesdefinition = require("./definitions/sac-a-malices.definition");
const _sacamalicessetupservice = require("./setup/sac-a-malices-setup.service");
const _sacamalicesactionservice = require("./actions/sac-a-malices-action.service");
const _sacamalicespresenterservice = require("./presenter/sac-a-malices-presenter.service");
const _sacamalicesbotservice = require("./bots/sac-a-malices-bot.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/rulebook"));
const _sacamalicesshortcuts = require("./sac-a-malices.shortcuts");
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
let SacAMalicesService = class SacAMalicesService extends _abstractgameservice.AbstractGameService {
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
    getBotActions(state, botPlayerId) {
        return this.bots.getBotActions(state, botPlayerId);
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
    getShortcuts(ctx) {
        return (0, _sacamalicesshortcuts.buildSacAMalicesShortcuts)(ctx);
    }
    constructor(registry, setup, actions, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.presenter = presenter, this.bots = bots, this.gameType = 'sac-a-malices', this.category = 'JeuxDePlateaux', this.subcategory = 'LesQuatreVents', this.displayName = _sacamalicesdefinition.SAC_A_MALICES_GAME.displayName, this.description = 'Monopoly Dijon (Chouette et Fortune).', this.minPlayers = _sacamalicesdefinition.SAC_A_MALICES_GAME.minPlayers, this.maxPlayers = _sacamalicesdefinition.SAC_A_MALICES_GAME.maxPlayers;
    }
};
SacAMalicesService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _sacamalicessetupservice.SacAMalicesSetupService === "undefined" ? Object : _sacamalicessetupservice.SacAMalicesSetupService,
        typeof _sacamalicesactionservice.SacAMalicesActionService === "undefined" ? Object : _sacamalicesactionservice.SacAMalicesActionService,
        typeof _sacamalicespresenterservice.SacAMalicesPresenterService === "undefined" ? Object : _sacamalicespresenterservice.SacAMalicesPresenterService,
        typeof _sacamalicesbotservice.SacAMalicesBotService === "undefined" ? Object : _sacamalicesbotservice.SacAMalicesBotService
    ])
], SacAMalicesService);
