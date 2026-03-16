"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AFondLesBallonsService", {
    enumerable: true,
    get: function() {
        return AFondLesBallonsService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _gamedefinition = require("./definitions/game.definition");
const _afondlesballonssetupservice = require("./setup/a-fond-les-ballons-setup.service");
const _afondlesballonsactionservice = require("./actions/a-fond-les-ballons-action.service");
const _afondlesballonspresenterservice = require("./presenter/a-fond-les-ballons-presenter.service");
const _afondlesballonsbotservice = require("./bots/a-fond-les-ballons-bot.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/rulebook"));
const _afondlesballonsshortcuts = require("./a-fond-les-ballons.shortcuts");
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
let AFondLesBallonsService = class AFondLesBallonsService extends _abstractgameservice.AbstractGameService {
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
        return (0, _afondlesballonsshortcuts.buildAFondLesBallonsShortcuts)(ctx);
    }
    constructor(registry, setup, actions, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.presenter = presenter, this.bots = bots, this.gameType = 'a-fond-les-ballons', this.category = 'JeuxDePlateaux', this.subcategory = 'LesQuatreVents', this.displayName = _gamedefinition.A_FOND_LES_BALLONS_GAME.displayName, this.description = "Course déjantée jusqu'à la Grosse Noix Dorée.", this.minPlayers = _gamedefinition.A_FOND_LES_BALLONS_GAME.minPlayers, this.maxPlayers = _gamedefinition.A_FOND_LES_BALLONS_GAME.maxPlayers;
    }
};
AFondLesBallonsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _afondlesballonssetupservice.AFondLesBallonsSetupService === "undefined" ? Object : _afondlesballonssetupservice.AFondLesBallonsSetupService,
        typeof _afondlesballonsactionservice.AFondLesBallonsActionService === "undefined" ? Object : _afondlesballonsactionservice.AFondLesBallonsActionService,
        typeof _afondlesballonspresenterservice.AFondLesBallonsPresenterService === "undefined" ? Object : _afondlesballonspresenterservice.AFondLesBallonsPresenterService,
        typeof _afondlesballonsbotservice.AFondLesBallonsBotService === "undefined" ? Object : _afondlesballonsbotservice.AFondLesBallonsBotService
    ])
], AFondLesBallonsService);
