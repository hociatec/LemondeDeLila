"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "JeuOieService", {
    enumerable: true,
    get: function() {
        return JeuOieService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("./rulebook/rulebook"));
const _jeuoieactionservice = require("./actions/jeu-oie-action.service");
const _jeuoiephaseservice = require("./phases/jeu-oie-phase.service");
const _jeuoiepresenterservice = require("./presenter/jeu-oie-presenter.service");
const _jeuoiesetupservice = require("./setup/jeu-oie-setup.service");
const _gamedefinition = require("./definitions/game.definition");
const _jeuoiebotservice = require("./bots/jeu-oie-bot.service");
const _jeuoieshortcuts = require("./jeu-oie.shortcuts");
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
let JeuOieService = class JeuOieService extends _abstractgameservice.AbstractGameService {
    hydrateInitialState(baseState) {
        return this.setup.hydrateInitialState(baseState);
    }
    applyActions(state, actions) {
        const next = this.actions.applyActions(state, actions);
        return this.phases.advance(next);
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
        return (0, _jeuoieshortcuts.buildJeuOieShortcuts)(ctx);
    }
    constructor(registry, setup, actions, phases, presenter, bots){
        super(registry), this.setup = setup, this.actions = actions, this.phases = phases, this.presenter = presenter, this.bots = bots, this.gameType = 'jeu-oie', this.category = 'JeuxDePlateaux', this.subcategory = 'Les Vents Sacrés', this.displayName = _gamedefinition.JEU_OIE_GAME.displayName, this.description = "Le jeu de l'oie (course sur 63 cases).", this.minPlayers = _gamedefinition.JEU_OIE_GAME.minPlayers, this.maxPlayers = _gamedefinition.JEU_OIE_GAME.maxPlayers;
    }
};
JeuOieService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _jeuoiesetupservice.JeuOieSetupService === "undefined" ? Object : _jeuoiesetupservice.JeuOieSetupService,
        typeof _jeuoieactionservice.JeuOieActionService === "undefined" ? Object : _jeuoieactionservice.JeuOieActionService,
        typeof _jeuoiephaseservice.JeuOiePhaseService === "undefined" ? Object : _jeuoiephaseservice.JeuOiePhaseService,
        typeof _jeuoiepresenterservice.JeuOiePresenterService === "undefined" ? Object : _jeuoiepresenterservice.JeuOiePresenterService,
        typeof _jeuoiebotservice.JeuOieBotService === "undefined" ? Object : _jeuoiebotservice.JeuOieBotService
    ])
], JeuOieService);
