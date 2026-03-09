"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DameNatureService", {
    enumerable: true,
    get: function() {
        return DameNatureService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/rulebook"));
const _damenatureactionservice = require("./actions/dame-nature-action.service");
const _damenaturepresenterservice = require("./presenter/dame-nature-presenter.service");
const _damenaturesetupservice = require("./setup/dame-nature-setup.service");
const _damenaturebotservice = require("./bots/dame-nature-bot.service");
const _gamedefinition = require("./definitions/game.definition");
const _damenatureshortcuts = require("./dame-nature.shortcuts");
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
let DameNatureService = class DameNatureService extends _abstractgameservice.AbstractGameService {
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
        return (0, _damenatureshortcuts.buildDameNatureShortcuts)(ctx);
    }
    constructor(registry, setup, actions, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.presenter = presenter, this.bots = bots, this.gameType = 'dame-nature', this.category = 'JeuxDePlateaux', this.subcategory = 'VentsDansants', this.displayName = _gamedefinition.DAME_NATURE_GAME.displayName, this.description = 'Collectez quatre familles complètes tout en protégeant Dame Nature des pollutions.', this.minPlayers = _gamedefinition.DAME_NATURE_GAME.minPlayers, this.maxPlayers = _gamedefinition.DAME_NATURE_GAME.maxPlayers;
    }
};
DameNatureService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _damenaturesetupservice.DameNatureSetupService === "undefined" ? Object : _damenaturesetupservice.DameNatureSetupService,
        typeof _damenatureactionservice.DameNatureActionService === "undefined" ? Object : _damenatureactionservice.DameNatureActionService,
        typeof _damenaturepresenterservice.DameNaturePresenterService === "undefined" ? Object : _damenaturepresenterservice.DameNaturePresenterService,
        typeof _damenaturebotservice.DameNatureBotService === "undefined" ? Object : _damenaturebotservice.DameNatureBotService
    ])
], DameNatureService);
