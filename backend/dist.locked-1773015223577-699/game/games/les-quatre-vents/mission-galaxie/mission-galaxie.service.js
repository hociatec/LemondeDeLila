"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MissionGalaxieService", {
    enumerable: true,
    get: function() {
        return MissionGalaxieService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _missiongalaxiedefinition = require("./definitions/mission-galaxie.definition");
const _missiongalaxiesetupservice = require("./setup/mission-galaxie-setup.service");
const _missiongalaxieactionservice = require("./actions/mission-galaxie-action.service");
const _missiongalaxiepresenterservice = require("./presenter/mission-galaxie-presenter.service");
const _missiongalaxiebotservice = require("./bots/mission-galaxie-bot.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/rulebook"));
const _missiongalaxieshortcuts = require("./shortcuts/mission-galaxie.shortcuts");
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
let MissionGalaxieService = class MissionGalaxieService extends _abstractgameservice.AbstractGameService {
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
        return (0, _missiongalaxieshortcuts.buildMissionGalaxieShortcuts)(ctx);
    }
    constructor(registry, setup, actions, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.presenter = presenter, this.bots = bots, this.gameType = 'mission-galaxie', this.category = 'JeuxDePlateaux', this.subcategory = 'LesQuatreVents', this.displayName = _missiongalaxiedefinition.MISSION_GALAXIE_GAME.displayName, this.description = 'Course cosmique autour de 50 cases : questions, défis et événements vous propulsent vers la planète légendaire.', this.minPlayers = _missiongalaxiedefinition.MISSION_GALAXIE_GAME.minPlayers, this.maxPlayers = _missiongalaxiedefinition.MISSION_GALAXIE_GAME.maxPlayers;
    }
};
MissionGalaxieService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _missiongalaxiesetupservice.MissionGalaxieSetupService === "undefined" ? Object : _missiongalaxiesetupservice.MissionGalaxieSetupService,
        typeof _missiongalaxieactionservice.MissionGalaxieActionService === "undefined" ? Object : _missiongalaxieactionservice.MissionGalaxieActionService,
        typeof _missiongalaxiepresenterservice.MissionGalaxiePresenterService === "undefined" ? Object : _missiongalaxiepresenterservice.MissionGalaxiePresenterService,
        typeof _missiongalaxiebotservice.MissionGalaxieBotService === "undefined" ? Object : _missiongalaxiebotservice.MissionGalaxieBotService
    ])
], MissionGalaxieService);
