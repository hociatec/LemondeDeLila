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
