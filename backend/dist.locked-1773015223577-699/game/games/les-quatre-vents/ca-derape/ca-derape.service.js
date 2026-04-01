"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CaDerapeService", {
    enumerable: true,
    get: function() {
        return CaDerapeService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _cadefinition = require("./definitions/ca.definition");
const _casetup = require("./setup/ca.setup");
const _caactionsservice = require("./actions/ca-actions.service");
const _capresenterservice = require("./presenter/ca-presenter.service");
const _cabotservice = require("./bots/ca-bot.service");
const _carulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/ca.rulebook"));
const _caderapeshortcuts = require("./ca-derape.shortcuts");
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
let CaDerapeService = class CaDerapeService extends _abstractgameservice.AbstractGameService {
    hydrateInitialState(baseState) {
        return this.setup.hydrateInitialState(baseState);
    }
    applyActions(state, actions) {
        return this.actions.applyActions(state, actions);
    }
    getAvailableActions(state, playerId) {
        return _carulebook.getAvailableActions(state, playerId);
    }
    validateAction(state, action, actorId) {
        return _carulebook.validateAction(state, action, actorId);
    }
    getBotActions(state, botPlayerId) {
        return this.bots.getBotActions(state, botPlayerId);
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
    getShortcuts(ctx) {
        return (0, _caderapeshortcuts.buildCaDerapeShortcuts)(ctx);
    }
    constructor(registry, setup, actions, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.presenter = presenter, this.bots = bots, this.gameType = 'ca-derape', this.category = 'JeuxDePlateaux', this.subcategory = 'LesQuatreVents', this.displayName = _cadefinition.CA_DERAPE_GAME.displayName, this.description = 'Course chaotique sur 30 cases avec cartes Situation.', this.minPlayers = _cadefinition.CA_DERAPE_GAME.minPlayers, this.maxPlayers = _cadefinition.CA_DERAPE_GAME.maxPlayers;
    }
};
CaDerapeService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _casetup.CaSetupService === "undefined" ? Object : _casetup.CaSetupService,
        typeof _caactionsservice.CaActionService === "undefined" ? Object : _caactionsservice.CaActionService,
        typeof _capresenterservice.CaPresenterService === "undefined" ? Object : _capresenterservice.CaPresenterService,
        typeof _cabotservice.CaBotService === "undefined" ? Object : _cabotservice.CaBotService
    ])
], CaDerapeService);
